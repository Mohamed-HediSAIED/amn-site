#!/usr/bin/env node
/* ------------------------------------------------------------------
   Vérification dans un vrai navigateur (Chromium via Playwright).

   Ce que ça contrôle réellement, pas « en principe » :
     1. les 8 pages à 5 largeurs — aucune erreur de console, aucune
        requête en échec, aucun débordement horizontal, polices chargées,
        et AUCUN appel sortant vers un domaine tiers ;
     2. l'accessibilité de base — lien d'évitement, focus visible,
        page courante signalée, menu mobile, contraste du texte ;
     3. le formulaire, envoyé POUR DE VRAI contre la vraie fonction
        serverless : cas nominal, sans JavaScript, piège à robots,
        piège temporel, champ manquant, limite de fréquence, origine
        étrangère, et aucun canal configuré ;
     4. les en-têtes de sécurité tels qu'ils sont RÉELLEMENT servis.

     node scripts/verifier-navigateur.mjs
   ------------------------------------------------------------------ */
import { createServer } from 'node:http';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { demarrer } from './serveur-local.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const PORT = 4181;
const PORT_SINK = 4182;
const BASE = `http://localhost:${PORT}`;

function chargerPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try {
      return require(p);
    } catch {
      /* essai suivant */
    }
  }
  throw new Error('Playwright introuvable : npm i -D playwright && npx playwright install chromium');
}

let ok = 0;
const echecs = [];
const t = (nom, condition, detail = '') => {
  if (condition) {
    ok++;
  } else {
    echecs.push(`${nom}${detail ? ' — ' + detail : ''}`);
  }
};

const { chromium } = chargerPlaywright();

/* Boîte de réception factice : c'est elle qui prouve qu'un message est
   réellement parti, plutôt qu'un « merci » affiché à l'écran. */
const recus = [];
const sink = createServer((req, res) => {
  let corps = '';
  req.on('data', (c) => (corps += c));
  req.on('end', () => {
    try {
      recus.push(JSON.parse(corps));
    } catch {
      recus.push({ illisible: corps });
    }
    res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
  });
});
await new Promise((r) => sink.listen(PORT_SINK, r));

const serveur = await demarrer({ port: PORT, silencieux: true });
const contact = require(join(RACINE, 'api', 'contact.js'));
const navigateur = await chromium.launch();

const PAGES = readdirSync(RACINE)
  .filter((f) => f.endsWith('.html'))
  .map((f) => (f === 'index.html' ? '/' : '/' + f.replace(/\.html$/, '')))
  .sort();

const LARGEURS = [320, 390, 768, 1024, 1440];

/* ================= 1. Pages × largeurs ================= */

console.log(`\n1. ${PAGES.length} pages × ${LARGEURS.length} largeurs`);

for (const largeur of LARGEURS) {
  for (const chemin of PAGES) {
    const page = await navigateur.newPage({ viewport: { width: largeur, height: 900 } });
    const erreursConsole = [];
    const requetesKO = [];
    const externes = [];

    page.on('console', (m) => m.type() === 'error' && erreursConsole.push(m.text()));
    page.on('pageerror', (e) => erreursConsole.push(String(e)));
    page.on('requestfailed', (r) => requetesKO.push(`${r.url()} (${r.failure()?.errorText})`));
    page.on('response', (r) => {
      if (r.status() >= 400) requetesKO.push(`${r.url()} → ${r.status()}`);
    });
    page.on('request', (r) => {
      if (!r.url().startsWith(BASE) && !r.url().startsWith('data:')) externes.push(r.url());
    });

    await page.goto(BASE + chemin, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);

    const etiquette = `${chemin} @${largeur}`;
    t(`${etiquette} — console propre`, erreursConsole.length === 0, erreursConsole.join(' | '));
    t(`${etiquette} — aucune requête en échec`, requetesKO.length === 0, requetesKO.join(' | '));
    t(`${etiquette} — aucun appel à un tiers`, externes.length === 0, externes.join(' | '));

    const debordement = await page.evaluate(() => {
      const limite = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth <= limite + 1) return null;
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.right > limite + 1 || r.left < -1) {
          return `${el.tagName.toLowerCase()}.${el.className || '(sans classe)'} → ${Math.round(r.right)}px`;
        }
      }
      return 'origine non identifiée';
    });
    t(`${etiquette} — pas de débordement horizontal`, debordement === null, debordement || '');

    if (largeur === 1440) {
      const polices = await page.evaluate(() => ({
        sg: document.fonts.check('500 16px "Space Grotesk"'),
        jb: document.fonts.check('400 12px "JetBrains Mono"')
      }));
      t(`${chemin} — Space Grotesk chargée`, polices.sg);
      t(`${chemin} — JetBrains Mono chargée`, polices.jb);

      const h1 = await page.locator('h1').count();
      t(`${chemin} — exactement un h1`, h1 === 1, `trouvé ${h1}`);
    }

    await page.close();
  }
}

/* ================= 2. Accessibilité ================= */

console.log('2. Accessibilité');
{
  const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  await page.keyboard.press('Tab');
  const premierFocus = await page.evaluate(() => {
    const el = document.activeElement;
    const r = el.getBoundingClientRect();
    return { texte: el.textContent.trim(), visible: r.left >= 0 && r.width > 0 };
  });
  t("Tab atteint d'abord le lien d'évitement", /contenu/i.test(premierFocus.texte), premierFocus.texte);
  t("Le lien d'évitement devient visible au focus", premierFocus.visible);

  const courante = await page.locator('.nav a[aria-current="page"]').count();
  t('La page courante est signalée dans la navigation', courante === 1, `trouvé ${courante}`);

  const anneau = await page.evaluate(() => {
    const a = document.querySelector('.nav a');
    a.focus();
    const s = getComputedStyle(a);
    return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2;
  });
  t('Anneau de focus visible sur les liens', anneau);

  await page.close();
}

/* Contraste — mesuré sur les couleurs RÉELLEMENT rendues, et sur le
   fond effectif de l'élément (pas sur le fond de la page : c'est là que
   la première version passait à côté d'un texte à 4,32:1 sur carte). */
const CIBLES_CONTRASTE = {
  '/': [
    ['texte courant', '.lead'],
    ['repère mono', '.mono'],
    ['note discrète', '.hero-note'],
    ['puce de module', '.chip'],
    ['bouton principal', '.btn-primary'],
    ['bouton secondaire', '.btn-ghost'],
    ['lien de pied de page', '.ftr a'],
    ['titre de colonne du pied', '.ftr h2'],
    ['note du bloc double', '.split-note'],
    ['description du pied', '.ftr-about p'],
    ['mention du bas', '.ftr-bottom p'],
    ['intitulé de suivi', '.watch li b'],
    ['texte de suivi', '.watch li']
  ],
  '/contact': [
    ['libellé de champ', '.field .lbl'],
    ['aide de champ', '.field .hint'],
    ['mention sous le bouton', '.form-foot .mono-sm'],
    ['étape du panneau latéral', '.aside-panel ol li'],
    ['puce du panneau latéral', '.aside-panel ul li'],
    ['saisie', '#nom']
  ],
  '/service': [
    ['nom de module', '.mods b'],
    ['description de module', '.mods span']
  ],
  '/methode': [
    ['numéro d\'étape', '.steps .n'],
    ['encadré d\'étape', '.steps .aside']
  ],
  '/page-inexistante': [['grand code 404', '.four04 .code']]
};

for (const [chemin, cibles] of Object.entries(CIBLES_CONTRASTE)) {
  const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + chemin, { waitUntil: 'networkidle' });
  const contrastes = await page.evaluate((cibles) => {
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const lum = (rgb) => {
      const [r, g, b] = rgb.map((v) => lin(v / 255));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const nombres = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const fond = (el) => {
      for (let n = el; n; n = n.parentElement) {
        const bg = getComputedStyle(n).backgroundColor;
        const a = (bg.match(/[\d.]+/g) || [])[3];
        if (bg && bg !== 'transparent' && a !== '0') return nombres(bg);
      }
      return [0, 0, 0];
    };
    return cibles.map(([nom, sel]) => {
      const el = document.querySelector(sel);
      if (!el) return { nom, ratio: null };
      const s = getComputedStyle(el);
      const l1 = lum(nombres(s.color));
      const l2 = lum(fond(el));
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const px = parseFloat(s.fontSize);
      const gras = parseInt(s.fontWeight, 10) >= 700;
      const grand = px >= 24 || (px >= 18.66 && gras);
      return { nom, ratio: Math.round(ratio * 100) / 100, seuil: grand ? 3 : 4.5 };
    });
  }, cibles);
  for (const c of contrastes) {
    t(
      `Contraste ${chemin} — ${c.nom}`,
      c.ratio !== null && c.ratio >= c.seuil,
      c.ratio === null ? 'élément absent' : `${c.ratio}:1 (minimum ${c.seuil}:1)`
    );
  }
  await page.close();
}
{
  const page = await navigateur.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  t('Menu mobile fermé au chargement', !(await page.locator('.menu').evaluate((d) => d.open)));
  await page.locator('.menu summary').click();
  t('Menu mobile ouvert au clic', await page.locator('.menu').evaluate((d) => d.open));
  t('Menu mobile visible', await page.locator('.menu-panel a[href="/service"]').isVisible());
  await page.keyboard.press('Escape');
  t('Échap referme le menu', !(await page.locator('.menu').evaluate((d) => d.open)));
  await page.close();
}
{
  /* Sans JavaScript, le menu doit rester utilisable : c'est tout
     l'intérêt d'un <details> plutôt que d'un bouton scripté. */
  const ctx = await navigateur.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 }
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.locator('.menu summary').click();
  t('Menu mobile fonctionne sans JavaScript', await page.locator('.menu-panel a[href="/service"]').isVisible());
  await ctx.close();
}
{
  const ctx = await navigateur.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const duree = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.btn-primary')).transitionDuration
  );
  t('Mouvement réduit respecté', parseFloat(duree) < 0.01, duree);
  await ctx.close();
}

/* ================= 3. Formulaire ================= */

console.log('3. Formulaire (envois réels)');

async function remplir(page, { attendre = 3000, piege = false, champs = {} } = {}) {
  await page.goto(BASE + '/contact', { waitUntil: 'networkidle' });
  const v = {
    nom: 'Claire Dupont',
    structure: 'Atelier Dupont',
    email: 'claire@atelier-dupont.fr',
    besoin: "Je gère mes devis dans un traitement de texte et j'ai perdu deux factures.",
    ...champs
  };
  for (const [k, val] of Object.entries(v)) {
    if (val === null) continue;
    await page.fill(`#${k}`, val);
  }
  if (piege) await page.evaluate(() => (document.getElementById('site_web').value = 'https://spam.example'));
  if (attendre) await page.waitForTimeout(attendre);
  await page.locator('#submit').scrollIntoViewIfNeeded();
  await page.click('#submit');
}

/* 3.1 — aucun canal configuré : le site doit le DIRE, pas avaler. */
delete process.env.CONTACT_WEBHOOK_URL;
delete process.env.RESEND_API_KEY;
contact.reinitialiserCompteurs();
{
  const page = await navigateur.newPage({ viewport: { width: 1280, height: 900 } });
  await remplir(page);
  await page.waitForSelector('#form-err:not([hidden])', { timeout: 5000 }).catch(() => {});
  const visible = await page.locator('#form-err').isVisible();
  const texte = await page.locator('#form-err-text').textContent();
  t('Sans canal configuré : erreur affichée, pas de faux « merci »', visible, texte);
  t('Sans canal configuré : le succès n\'est PAS affiché', !(await page.locator('#form-ok').isVisible()));
  await page.close();
}

/* À partir d'ici, un canal existe. */
process.env.CONTACT_WEBHOOK_URL = `http://localhost:${PORT_SINK}/`;
contact.reinitialiserCompteurs();

/* 3.2 — cas nominal */
{
  const page = await navigateur.newPage({ viewport: { width: 1280, height: 900 } });
  const avant = recus.length;
  await remplir(page);
  await page.waitForSelector('#form-ok:not([hidden])', { timeout: 8000 }).catch(() => {});
  t('Cas nominal : message de succès affiché', await page.locator('#form-ok').isVisible());
  t('Cas nominal : formulaire masqué après envoi', !(await page.locator('#contact-form').isVisible()));
  t('Cas nominal : la demande est bien arrivée', recus.length === avant + 1, `${recus.length - avant} reçue(s)`);
  const d = recus[recus.length - 1] || {};
  t('Cas nominal : les quatre champs sont transmis', d.nom === 'Claire Dupont' && d.structure === 'Atelier Dupont' && d.email === 'claire@atelier-dupont.fr' && /deux factures/.test(d.besoin || ''));
  t("Cas nominal : aucune adresse IP dans la charge utile", !JSON.stringify(d).includes('127.0.0.1'));
  await page.close();
}

/* 3.3 — sans JavaScript : envoi natif, réponse en HTML */
contact.reinitialiserCompteurs();
{
  const ctx = await navigateur.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const avant = recus.length;
  await page.goto(BASE + '/contact', { waitUntil: 'load' });
  await page.fill('#nom', 'Marc Sans-JS');
  await page.fill('#structure', 'Garage Central');
  await page.fill('#email', 'marc@garage-central.fr');
  await page.fill('#besoin', 'Mon site ne répond plus depuis hier et je ne sais pas qui appeler.');
  await page.click('#submit');
  await page.waitForLoadState('load');
  const titre = await page.locator('h1').textContent();
  t('Sans JavaScript : page de confirmation servie', /envoyé/i.test(titre || ''), titre);
  t('Sans JavaScript : la demande est bien arrivée', recus.length === avant + 1);
  t(
    'Sans JavaScript : la confirmation reste sur la charte du site',
    (await page.locator('.logo-word').count()) === 1
  );
  await ctx.close();
}

/* 3.4 — piège à robots */
contact.reinitialiserCompteurs();
{
  const page = await navigateur.newPage({ viewport: { width: 1280, height: 900 } });
  const avant = recus.length;
  await remplir(page, { piege: true });
  await page.waitForSelector('#form-ok:not([hidden])', { timeout: 8000 }).catch(() => {});
  t('Piège à robots : « merci » affiché (on ne renseigne pas le script)', await page.locator('#form-ok').isVisible());
  t('Piège à robots : RIEN n\'est envoyé', recus.length === avant, `${recus.length - avant} reçue(s)`);
  t('Piège à robots : le champ est hors du parcours clavier', (await page.locator('#site_web').getAttribute('tabindex')) === '-1');
  await page.close();
}

/* 3.5 — piège temporel */
contact.reinitialiserCompteurs();
{
  const page = await navigateur.newPage({ viewport: { width: 1280, height: 900 } });
  const avant = recus.length;
  await remplir(page, { attendre: 0 });
  await page.waitForSelector('#form-ok:not([hidden])', { timeout: 8000 }).catch(() => {});
  t('Piège temporel : envoi immédiat écarté', recus.length === avant, `${recus.length - avant} reçue(s)`);
  await page.close();
}

/* 3.5 bis — validation : native sans JavaScript, la nôtre avec */
{
  const ctx = await navigateur.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/contact', { waitUntil: 'load' });
  t(
    'Sans JavaScript : la validation native du navigateur reste active',
    !(await page.locator('#contact-form').evaluate((f) => f.noValidate))
  );
  await ctx.close();

  const page2 = await navigateur.newPage({ viewport: { width: 1280, height: 900 } });
  await page2.goto(BASE + '/contact', { waitUntil: 'networkidle' });
  t(
    'Avec JavaScript : la validation native est remplacée par la nôtre',
    await page2.locator('#contact-form').evaluate((f) => f.noValidate)
  );
  await page2.fill('#nom', 'Sans email');
  await page2.fill('#structure', 'Essai');
  await page2.fill('#besoin', 'Un message assez long pour passer la longueur minimale.');
  await page2.locator('#submit').scrollIntoViewIfNeeded();
  await page2.click('#submit');
  t('Champ manquant : message affiché sur la page', await page2.locator('#form-err').isVisible());
  t(
    'Champ manquant : le focus revient sur le champ fautif',
    (await page2.evaluate(() => document.activeElement.id)) === 'email'
  );
  await page2.close();
}

/* 3.6 — champ manquant, validation côté serveur */
contact.reinitialiserCompteurs();
{
  const r = await fetch(`${BASE}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ nom: 'X', structure: 'Y', email: 'pas-un-email', besoin: 'assez long pour passer' })
  });
  const j = await r.json();
  t('Email invalide refusé côté serveur', r.status === 400 && !j.ok, `${r.status} ${JSON.stringify(j)}`);

  const r2 = await fetch(`${BASE}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ nom: 'X', structure: '', email: 'a@b.fr', besoin: 'assez long pour passer' })
  });
  t('Champ obligatoire vide refusé côté serveur', r2.status === 400);

  const r3 = await fetch(`${BASE}/api/contact`, { method: 'GET', headers: { Origin: BASE } });
  t('GET refusé (405)', r3.status === 405);
}

/* 3.7 — origine étrangère */
{
  const r = await fetch(`${BASE}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://site-malveillant.example' },
    body: JSON.stringify({ nom: 'A', structure: 'B', email: 'a@b.fr', besoin: 'assez long pour passer' })
  });
  t('Envoi depuis une autre origine refusé (403)', r.status === 403, String(r.status));
  t("Aucun en-tête CORS permissif renvoyé", r.headers.get('access-control-allow-origin') === null);
}

/* 3.8 — message truffé de liens */
contact.reinitialiserCompteurs();
{
  const avant = recus.length;
  const r = await fetch(`${BASE}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({
      nom: 'Spam Bot',
      structure: 'SEO',
      email: 'bot@spam.example',
      besoin: 'https://a.example https://b.example https://c.example https://d.example'
    })
  });
  await new Promise((r2) => setTimeout(r2, 200));
  t('Message truffé de liens écarté', r.status === 200 && recus.length === avant);
}

/* 3.9 — limite de fréquence */
contact.reinitialiserCompteurs();
{
  const envoyer = (i) =>
    fetch(`${BASE}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE },
      body: JSON.stringify({
        nom: `Test ${i}`,
        structure: 'Essai',
        email: `test${i}@exemple.fr`,
        besoin: 'Message de test suffisamment long pour passer la validation.'
      })
    });

  const codes = [];
  for (let i = 0; i < contact.LIMITS.BURST.max + 2; i++) codes.push((await envoyer(i)).status);

  const passes = codes.filter((c) => c === 200).length;
  const bloques = codes.filter((c) => c === 429).length;
  t(
    `Limite de fréquence : ${contact.LIMITS.BURST.max} passent, le reste est bloqué`,
    passes === contact.LIMITS.BURST.max && bloques === 2,
    codes.join(', ')
  );

  const r = await envoyer(99);
  t('Réponse 429 accompagnée de Retry-After', r.headers.get('retry-after') !== null);
}

/* 3.10 — charge utile démesurée */
{
  const r = await fetch(`${BASE}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ nom: 'A', structure: 'B', email: 'a@b.fr', besoin: 'x'.repeat(200000) })
  });
  t('Corps démesuré refusé', r.status === 413, String(r.status));
}

/* 3.11 — pas d'injection HTML dans le message livré */
contact.reinitialiserCompteurs();
{
  const r = await fetch(`${BASE}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({
      nom: '<script>alert(1)</script>',
      structure: 'Essai',
      email: 'a@b.fr',
      besoin: "Bonjour <img src=x onerror=alert(1)>, j'aimerais un accès.\r\nBcc: victime@exemple.fr"
    })
  });
  await new Promise((x) => setTimeout(x, 200));
  const d = recus[recus.length - 1] || {};
  t('Injection : la demande passe (le contenu n\'est pas censuré)', r.status === 200);
  t(
    'Injection : aucun retour à la ligne dans les champs qui servent d\'en-têtes',
    !/[\r\n]/.test(d.nom || '') && !/[\r\n]/.test(d.email || '') && !/[\r\n]/.test(d.structure || '')
  );
}

/* ================= 4. En-têtes de sécurité ================= */

console.log('4. En-têtes de sécurité réellement servis');
{
  const r = await fetch(BASE + '/');
  const csp = r.headers.get('content-security-policy') || '';
  t('Content-Security-Policy envoyée', csp.length > 0);
  t("CSP : script-src limité au site (plus les empreintes JSON-LD)", /script-src 'self'( 'sha256-[^']+')*;/.test(csp), csp);
  t("CSP : object-src 'none'", /object-src 'none'/.test(csp));
  t("CSP : frame-ancestors 'none'", /frame-ancestors 'none'/.test(csp));
  t("CSP : form-action 'self'", /form-action 'self'/.test(csp));
  t('X-Content-Type-Options: nosniff', r.headers.get('x-content-type-options') === 'nosniff');
  t('X-Frame-Options: DENY', r.headers.get('x-frame-options') === 'DENY');
  t('Referrer-Policy posée', (r.headers.get('referrer-policy') || '').includes('strict-origin'));
  t('Permissions-Policy posée', (r.headers.get('permissions-policy') || '').includes('camera=()'));

  const r404 = await fetch(BASE + '/page-qui-nexiste-pas');
  t('URL inconnue → 404 avec la page du site', r404.status === 404 && (await r404.text()).includes('404'));
}

/* ================= Rapport ================= */

await navigateur.close();
serveur.close();
sink.close();

console.log(`\n${'─'.repeat(58)}`);
if (echecs.length === 0) {
  console.log(`✓ ${ok} contrôles passés, aucun échec.`);
  process.exit(0);
}
console.log(`✗ ${echecs.length} ÉCHEC(S) sur ${ok + echecs.length} contrôles :\n`);
for (const e of echecs) console.log(`  • ${e}`);
process.exit(1);
