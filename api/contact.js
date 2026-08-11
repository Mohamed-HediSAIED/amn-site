'use strict';

/* ==================================================================
   POST /api/contact — demande d'accès
   ==================================================================
   Fonction serverless Node (Vercel). Aucune dépendance npm : l'appel à
   Resend se fait par son API REST avec le `fetch` natif. Le site reste
   donc un dépôt statique, sans `package.json`, sans lockfile, sans
   étape de construction — une chose de moins à maintenir et à auditer.

   RÉGLAGE (variables d'environnement du projet Vercel, jamais dans le
   code — voir README.md) :
     RESEND_API_KEY        clé d'API Resend
     CONTACT_TO            adresse qui reçoit les demandes
     CONTACT_FROM          expéditeur  (défaut : onboarding@resend.dev)
     CONTACT_WEBHOOK_URL   (optionnel) second canal, en JSON

   Au moins un des deux canaux — Resend ou webhook — doit être réglé.
   Si aucun ne l'est, l'endpoint répond 503 et le dit clairement plutôt
   que d'avaler la demande en silence. C'est le pire scénario possible
   pour un formulaire : afficher « merci » sans que rien ne parte.
   ================================================================== */

const crypto = require('node:crypto');

/* ---------- Réglages anti-abus (BLOC C) ---------- */

const LIMITS = {
  /* Par origine — deux fenêtres : une courte contre les rafales, une
     longue contre le goutte-à-goutte. */
  BURST: { windowMs: 10 * 60 * 1000, max: 3 },
  DAY: { windowMs: 24 * 60 * 60 * 1000, max: 10 },
  /* Plafond global de l'instance : dernier filet si quelqu'un fait
     tourner beaucoup d'adresses différentes. */
  GLOBAL: { windowMs: 60 * 60 * 1000, max: 60 },
  /* Délai minimal entre l'ouverture de la page et l'envoi. */
  MIN_FILL_MS: 2500,
  /* Bornes des champs — refusées AVANT tout traitement. */
  MAX_BODY_BYTES: 16 * 1024,
  NOM: 120,
  STRUCTURE: 160,
  EMAIL: 200,
  BESOIN_MIN: 10,
  BESOIN_MAX: 4000,
  /* Au-delà, le message est du référencement, pas une demande. */
  MAX_LINKS: 2,
  /* Garde-fou mémoire : au-delà, on oublie les origines les plus anciennes. */
  MAX_KEYS: 5000
};

/* État en mémoire de l'instance. Une fonction serverless peut être
   dupliquée ou recyclée : ce compteur ralentit fortement un script,
   il ne remplace pas un pare-feu. Pour un plafond dur, activer la
   limitation de débit de Vercel (Firewall) — expliqué dans README.md. */
const state = {
  hits: new Map(),
  global: [],
  /* Sel tiré au démarrage : les empreintes d'IP ne sont donc pas
     rejouables d'une instance à l'autre, ni comparables à une liste. */
  salt: crypto.randomBytes(16)
};

/* ---------- Utilitaires ---------- */

/** Empreinte non réversible de l'origine. On ne garde jamais l'IP. */
function originKey(req) {
  const fwd = req.headers['x-forwarded-for'];
  const raw =
    (typeof fwd === 'string' ? fwd.split(',')[0] : Array.isArray(fwd) ? fwd[0] : '') ||
    req.headers['x-real-ip'] ||
    (req.socket && req.socket.remoteAddress) ||
    'inconnue';
  return crypto
    .createHash('sha256')
    .update(state.salt)
    .update(String(raw).trim())
    .digest('base64')
    .slice(0, 22);
}

function prune(list, windowMs, now) {
  const cutoff = now - windowMs;
  let i = 0;
  while (i < list.length && list[i] < cutoff) i++;
  return i ? list.slice(i) : list;
}

/**
 * @returns {null|{retryAfter:number}} null si l'envoi est autorisé.
 */
function rateLimit(key) {
  const now = Date.now();

  state.global = prune(state.global, LIMITS.GLOBAL.windowMs, now);
  if (state.global.length >= LIMITS.GLOBAL.max) {
    return { retryAfter: Math.ceil(LIMITS.GLOBAL.windowMs / 1000) };
  }

  let list = prune(state.hits.get(key) || [], LIMITS.DAY.windowMs, now);

  const burst = list.filter((t) => t > now - LIMITS.BURST.windowMs);
  if (burst.length >= LIMITS.BURST.max) {
    state.hits.set(key, list);
    return {
      retryAfter: Math.ceil((burst[0] + LIMITS.BURST.windowMs - now) / 1000)
    };
  }
  if (list.length >= LIMITS.DAY.max) {
    state.hits.set(key, list);
    return { retryAfter: Math.ceil((list[0] + LIMITS.DAY.windowMs - now) / 1000) };
  }

  list = list.concat(now);
  state.hits.set(key, list);
  state.global = state.global.concat(now);

  /* Ménage : on ne laisse pas la table grossir indéfiniment. */
  if (state.hits.size > LIMITS.MAX_KEYS) {
    for (const [k, v] of state.hits) {
      if (!v.length || v[v.length - 1] < now - LIMITS.DAY.windowMs) state.hits.delete(k);
      if (state.hits.size <= LIMITS.MAX_KEYS) break;
    }
  }
  return null;
}

/** Lit le corps de la requête, que la plateforme l'ait déjà analysé ou non. */
function readBody(req) {
  if (req.body !== undefined && req.body !== null && req.body !== '') {
    return Promise.resolve(req.body);
  }

  /* Taille annoncée : on refuse avant d'avoir lu le moindre octet. */
  const annoncee = Number(req.headers['content-length']);
  if (Number.isFinite(annoncee) && annoncee > LIMITS.MAX_BODY_BYTES) {
    return Promise.reject(new Error('corps trop volumineux'));
  }

  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > LIMITS.MAX_BODY_BYTES) {
        /* Mettre le flux en pause, PAS le détruire : détruire la requête
           coupe la connexion avant que la réponse 413 ne parte, et le
           navigateur affiche une erreur réseau au lieu du message. */
        req.pause();
        reject(new Error('corps trop volumineux'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseFields(raw, contentType) {
  if (raw && typeof raw === 'object') return raw;
  const text = String(raw || '');
  if (!text) return {};
  if (/application\/json/i.test(contentType || '') || text.trimStart().startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  const out = {};
  for (const [k, v] of new URLSearchParams(text)) out[k] = v;
  return out;
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');
/** Une seule ligne, sans retours chariot : protège les en-têtes d'email. */
const oneLine = (v) => str(v).replace(/[\r\n\t]+/g, ' ').slice(0, 200);
const esc = (v) =>
  String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ---------- Réponses ---------- */

/** Le formulaire marche sans JavaScript : on répond alors une page. */
function wantsJson(req) {
  const accept = String(req.headers.accept || '');
  const ctype = String(req.headers['content-type'] || '');
  if (/application\/json/i.test(ctype)) return true;
  if (/application\/json/i.test(accept) && !/text\/html/i.test(accept)) return true;
  return false;
}

function htmlPage(status, title, body) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — AMN DevSec</title>
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#0a0a0a">
<link rel="icon" href="/assets/favicon-32.png" sizes="32x32" type="image/png">
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/site.css">
</head>
<body>
<header class="hdr"><div class="wrap hdr-in">
  <a class="logo" href="/" aria-label="AMN DevSec — accueil">
    <span class="logo-word">AMN</span><span class="logo-sub">DEVSEC</span>
  </a>
</div></header>
<main id="main"><section class="wrap legal">
  <p class="mono">Demande d'accès</p>
  <h1>${esc(title)}</h1>
  <p class="lead">${esc(body)}</p>
  <div class="btn-row more">
    <a class="btn btn-primary" href="/">Retour à l'accueil</a>
    ${status === 200 ? '' : '<a class="btn btn-ghost" href="/contact">Revenir au formulaire</a>'}
  </div>
</section></main>
</body>
</html>`;
}

function respond(req, res, status, payload) {
  res.setHeader('Cache-Control', 'no-store');
  if (payload.retryAfter) res.setHeader('Retry-After', String(payload.retryAfter));

  if (wantsJson(req)) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.statusCode = status;
    res.end(JSON.stringify(payload.json));
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.statusCode = status;
  res.end(htmlPage(status, payload.title, payload.body));
}

const OK = {
  json: { ok: true },
  title: "C'est envoyé",
  body:
    "Votre demande est arrivée. Vous recevrez une réponse écrite à l'adresse indiquée, " +
    'sous 48 h ouvrées. Inutile de la renvoyer.'
};

/* ---------- Acheminement ---------- */

function withTimeout(ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
}

async function sendViaResend(d) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO;
  if (!key || !to) return null;

  const from = process.env.CONTACT_FROM || 'AMN DevSec <onboarding@resend.dev>';
  const subject = `Demande d'accès — ${d.structure}`.slice(0, 180);

  const text = [
    `Nom       : ${d.nom}`,
    `Structure : ${d.structure}`,
    `Email     : ${d.email}`,
    '',
    'Besoin :',
    d.besoin,
    '',
    `— Envoyé depuis le formulaire du site, le ${d.recu}.`
  ].join('\n');

  const html = `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:15px;line-height:1.6;color:#111">
  <h2 style="font-size:17px;margin:0 0 16px">Nouvelle demande d'accès</h2>
  <p style="margin:0 0 4px"><strong>Nom&nbsp;:</strong> ${esc(d.nom)}</p>
  <p style="margin:0 0 4px"><strong>Structure&nbsp;:</strong> ${esc(d.structure)}</p>
  <p style="margin:0 0 16px"><strong>Email&nbsp;:</strong> <a href="mailto:${esc(d.email)}">${esc(d.email)}</a></p>
  <hr style="border:none;border-top:1px solid #ddd;margin:16px 0">
  <p style="margin:0 0 6px"><strong>Besoin&nbsp;:</strong></p>
  <p style="white-space:pre-wrap;margin:0">${esc(d.besoin)}</p>
  <hr style="border:none;border-top:1px solid #ddd;margin:16px 0">
  <p style="font-size:12px;color:#777;margin:0">Formulaire du site AMN DevSec — ${esc(d.recu)}.
  Répondre à ce message écrit directement à ${esc(d.email)}.</p>
</div>`;

  const t = withTimeout(10000);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: d.email,
        subject,
        text,
        html
      }),
      signal: t.signal
    });
    if (!res.ok) {
      console.error('[contact] Resend a répondu', res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error('[contact] Resend injoignable :', e && e.message);
    return false;
  } finally {
    t.done();
  }
}

async function sendViaWebhook(d) {
  const url = process.env.CONTACT_WEBHOOK_URL;
  if (!url) return null;

  const t = withTimeout(10000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'site-amn-devsec',
        recu: d.recu,
        nom: d.nom,
        structure: d.structure,
        email: d.email,
        besoin: d.besoin
      }),
      signal: t.signal
    });
    if (!res.ok) {
      console.error('[contact] Webhook a répondu', res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[contact] Webhook injoignable :', e && e.message);
    return false;
  } finally {
    t.done();
  }
}

/* ---------- Point d'entrée ---------- */

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return respond(req, res, 405, {
      json: { ok: false, error: 'Méthode non autorisée.' },
      title: 'Méthode non autorisée',
      body: 'Cette adresse ne répond qu\'aux envois du formulaire.'
    });
  }

  /* Même origine uniquement. Aucun en-tête CORS n'est renvoyé : un
     autre site ne peut donc pas poster ici depuis un navigateur. */
  const origin = req.headers.origin;
  if (origin) {
    let host = '';
    try {
      host = new URL(origin).host;
    } catch {
      host = '';
    }
    if (host !== req.headers.host) {
      return respond(req, res, 403, {
        json: { ok: false, error: 'Origine non autorisée.' },
        title: 'Origine non autorisée',
        body: 'Ce formulaire ne peut être envoyé que depuis le site lui-même.'
      });
    }
  }

  let fields;
  try {
    fields = parseFields(await readBody(req), req.headers['content-type']);
  } catch {
    /* Le reste du corps ne sera pas lu : on ferme après avoir répondu. */
    res.setHeader('Connection', 'close');
    return respond(req, res, 413, {
      json: { ok: false, error: 'Message trop volumineux.' },
      title: 'Message trop volumineux',
      body: 'Raccourcissez votre message et réessayez.'
    });
  }

  /* --- Piège à robots : rempli = on répond « merci » sans rien envoyer.
         Dire la vérité à un script l'aiderait seulement à s'ajuster. --- */
  if (str(fields.site_web)) {
    console.warn('[contact] piège à robots déclenché');
    return respond(req, res, 200, OK);
  }

  /* --- Piège temporel. `dt` est le temps passé sur la page, mesuré par
         le navigateur (donc insensible à une horloge mal réglée). Absent
         quand JavaScript est désactivé : le contrôle est alors ignoré. --- */
  const dt = Number(fields.dt);
  if (Number.isFinite(dt) && dt > 0 && dt < LIMITS.MIN_FILL_MS) {
    console.warn('[contact] formulaire rempli en', dt, 'ms — ignoré');
    return respond(req, res, 200, OK);
  }

  /* --- Validation --- */
  const nom = oneLine(fields.nom).slice(0, LIMITS.NOM);
  const structure = oneLine(fields.structure).slice(0, LIMITS.STRUCTURE);
  const email = oneLine(fields.email).slice(0, LIMITS.EMAIL);
  const besoin = str(fields.besoin).slice(0, LIMITS.BESOIN_MAX);

  const invalide = (msg) =>
    respond(req, res, 400, {
      json: { ok: false, error: msg },
      title: 'Demande incomplète',
      body: msg
    });

  if (!nom || !structure || !email || !besoin) {
    return invalide('Il manque un champ obligatoire.');
  }
  if (!EMAIL_RE.test(email)) {
    return invalide("L'adresse email ne semble pas valide.");
  }
  if (besoin.length < LIMITS.BESOIN_MIN) {
    return invalide('Décrivez votre besoin en quelques mots de plus.');
  }

  /* --- Heuristique de pourriel : un message truffé de liens n'est pas
         une demande d'accès. Réponse « merci », rien n'est envoyé. --- */
  const links = (besoin.match(/https?:\/\//gi) || []).length;
  if (links > LIMITS.MAX_LINKS || /\[url[=\]]|<a\s+href/i.test(besoin)) {
    console.warn('[contact] message écarté :', links, 'liens');
    return respond(req, res, 200, OK);
  }

  /* --- Limite de fréquence --- */
  const limited = rateLimit(originKey(req));
  if (limited) {
    const msg =
      'Trop de demandes envoyées depuis cette connexion. Réessayez plus tard — ' +
      'si votre première demande est partie, elle nous est bien arrivée.';
    return respond(req, res, 429, {
      json: { ok: false, error: msg },
      title: 'Trop de demandes',
      body: msg,
      retryAfter: limited.retryAfter
    });
  }

  /* --- Acheminement --- */
  const d = {
    nom,
    structure,
    email,
    besoin,
    recu: new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
  };

  const results = await Promise.all([sendViaResend(d), sendViaWebhook(d)]);
  const configures = results.filter((r) => r !== null);

  if (configures.length === 0) {
    console.error(
      '[contact] AUCUN canal configuré : régler RESEND_API_KEY + CONTACT_TO ' +
        '(ou CONTACT_WEBHOOK_URL) dans les variables du projet Vercel.'
    );
    const msg =
      "Le formulaire n'est pas encore relié à notre boîte. Votre message n'a pas été " +
      'envoyé — réessayez un peu plus tard.';
    return respond(req, res, 503, {
      json: { ok: false, error: msg },
      title: 'Formulaire indisponible',
      body: msg
    });
  }

  if (!configures.some(Boolean)) {
    const msg =
      "L'envoi n'a pas abouti de notre côté. Votre message n'est pas parti — réessayez dans un instant.";
    return respond(req, res, 502, {
      json: { ok: false, error: msg },
      title: "L'envoi n'a pas abouti",
      body: msg
    });
  }

  return respond(req, res, 200, OK);
};

/* Exposé au script de vérification, qui charge ce module dans le même
   processus que le serveur local. Rien de tout cela n'est atteignable
   par une requête HTTP. */
module.exports.LIMITS = LIMITS;
module.exports.reinitialiserCompteurs = function () {
  state.hits.clear();
  state.global = [];
};
