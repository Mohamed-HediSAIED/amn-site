#!/usr/bin/env node
/* ------------------------------------------------------------------
   Contrôles statiques, sans dépendance et en une seconde.

   Deux catégories, volontairement séparées :
     ERREUR  — quelque chose est cassé, à corriger dans le code ;
     À FAIRE — le code est bon, il manque une information qu'Aaron seul
               peut fournir (domaine réel, mentions légales).

   Le script sort en 1 s'il y a une ERREUR, en 2 s'il ne reste que des
   À FAIRE : on peut donc l'accrocher à un déploiement en distinguant
   « cassé » de « pas encore prêt pour le public ».

     node scripts/verifier-avant-mise-en-ligne.mjs
   ------------------------------------------------------------------ */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const erreurs = [];
const aFaire = [];
const ko = (m) => erreurs.push(m);
const todo = (m) => aFaire.push(m);

const pages = readdirSync(RACINE).filter((f) => f.endsWith('.html')).sort();
const html = Object.fromEntries(pages.map((p) => [p, readFileSync(join(RACINE, p), 'utf8')]));

/* Route publique correspondant à un fichier (cleanUrls). */
const route = (f) => (f === 'index.html' ? '/' : '/' + f.replace(/\.html$/, ''));

const origine = (html['index.html'].match(/<link rel="canonical" href="(https?:\/\/[^/"]+)/) || [])[1];
if (!origine) ko('index.html : aucune balise canonical.');

/* ---------- 1. Balises de tête ---------- */

for (const [f, src] of Object.entries(html)) {
  const doit = (re, quoi) => {
    if (!re.test(src)) ko(`${f} : ${quoi} manquant.`);
  };
  doit(/<meta charset="utf-8">/i, 'charset');
  doit(/<meta name="viewport"[^>]*width=device-width/i, 'viewport');
  doit(/<title>[^<]{10,}<\/title>/i, 'title');
  doit(/<html lang="fr">/i, 'lang="fr"');
  doit(/<meta name="description" content="[^"]{50,}"/i, 'description (≥ 50 caractères)');
  doit(/<meta name="robots"/i, 'meta robots');
  doit(/rel="icon"/i, 'favicon');
  doit(/href="\/assets\/fonts\.css"/i, 'feuille des polices');
  doit(/href="\/site\.css"/i, 'feuille de style');

  if (f === '404.html') continue;

  /* La page 404 mise à part, toutes doivent être partageables. */
  for (const prop of ['og:title', 'og:description', 'og:url', 'og:image', 'og:type']) {
    if (!new RegExp(`property="${prop}"`).test(src)) ko(`${f} : ${prop} manquant.`);
  }
  if (!/<meta name="twitter:card"/.test(src)) ko(`${f} : twitter:card manquant.`);

  /* Open Graph EXIGE des URL absolues. Un chemin relatif fait partir
     l'aperçu WhatsApp / Instagram sans image, sans erreur visible. */
  for (const prop of ['og:url', 'og:image']) {
    const v = (src.match(new RegExp(`property="${prop}" content="([^"]+)"`)) || [])[1];
    if (v && !/^https:\/\//.test(v)) ko(`${f} : ${prop} doit être une URL absolue (trouvé « ${v} »).`);
  }

  const canon = (src.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  const attendu = origine + route(f);
  if (canon !== attendu) ko(`${f} : canonical vaut « ${canon} », attendu « ${attendu} ».`);

  const ogUrl = (src.match(/property="og:url" content="([^"]+)"/) || [])[1];
  if (ogUrl !== attendu) ko(`${f} : og:url vaut « ${ogUrl} », attendu « ${attendu} ».`);
}

/* ---------- 2. Liens internes ---------- */

const routesConnues = new Set(pages.map(route));
for (const [f, src] of Object.entries(html)) {
  for (const m of src.matchAll(/href="([^"]+)"/g)) {
    const h = m[1];
    if (/^(https?:|mailto:|tel:)/.test(h)) continue;
    if (h === '#' || h === '') {
      ko(`${f} : lien mort href="${h}".`);
      continue;
    }
    if (h.startsWith('#')) continue;
    const chemin = h.split('#')[0].split('?')[0];
    if (routesConnues.has(chemin)) continue;
    if (existsSync(join(RACINE, chemin.replace(/^\//, '')))) continue;
    ko(`${f} : lien interne cassé vers « ${h} ».`);
  }
}

/* ---------- 3. Plan du site et robots ---------- */

const sitemap = readFileSync(join(RACINE, 'sitemap.xml'), 'utf8');
const dansSitemap = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));

for (const f of pages) {
  const src = html[f];
  const indexable = !/<meta name="robots" content="[^"]*noindex/i.test(src);
  const url = origine + route(f);
  if (indexable && !dansSitemap.has(url)) ko(`${f} est indexable mais absente de sitemap.xml.`);
  if (!indexable && dansSitemap.has(url)) ko(`${f} est en noindex mais présente dans sitemap.xml.`);
}
for (const url of dansSitemap) {
  if (!url.startsWith(origine)) ko(`sitemap.xml : « ${url} » n'est pas sur ${origine}.`);
}

const robots = readFileSync(join(RACINE, 'robots.txt'), 'utf8');
if (!robots.includes(`${origine}/sitemap.xml`)) {
  ko(`robots.txt ne pointe pas vers ${origine}/sitemap.xml.`);
}

/* ---------- 4. Sécurité ---------- */

try {
  execFileSync(process.execPath, [join(RACINE, 'scripts', 'csp-empreintes.mjs')], {
    stdio: 'pipe'
  });
} catch {
  ko('CSP décalée — lancer : node scripts/csp-empreintes.mjs --ecrire');
}

const SECRETS = [
  [/re_[A-Za-z0-9]{20,}/, 'clé Resend'],
  [/gh[pousr]_[A-Za-z0-9]{30,}/, 'jeton GitHub'],
  [/sk_(live|test)_[A-Za-z0-9]{16,}/, 'clé Stripe'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'clé privée']
];
const aScanner = [
  ...pages,
  'site.js',
  'site.css',
  'vercel.json',
  'api/contact.js',
  'assets/fonts.css'
];
for (const f of aScanner) {
  const src = readFileSync(join(RACINE, f), 'utf8');
  for (const [re, quoi] of SECRETS) if (re.test(src)) ko(`${f} : ${quoi} en clair.`);
}

/* Aucun code en ligne hors JSON-LD : la CSP le refuserait. */
for (const [f, src] of Object.entries(html)) {
  for (const m of src.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/type="application\/ld\+json"/i.test(m[1]) && m[2].trim()) {
      ko(`${f} : script en ligne non autorisé par la CSP.`);
    }
  }
  if (/\sstyle="/.test(src)) ko(`${f} : attribut style= en ligne (interdit par la CSP).`);
}

/* ---------- 5. Ce qui manque à Aaron ---------- */

if (origine.endsWith('.example')) {
  todo(
    `Le site pointe encore sur l'adresse de gabarit ${origine}.\n` +
      '     Après le premier déploiement :  node scripts/definir-domaine.mjs https://ADRESSE-REELLE'
  );
}

for (const [f, src] of Object.entries(html)) {
  const n = (src.match(/class="todo"/g) || []).length;
  if (n) todo(`${f} : ${n} mention(s) « à compléter » encore visible(s) en production.`);
}

if (!existsSync(join(RACINE, 'assets', 'og.png'))) {
  ko('assets/og.png absent — lancer : node scripts/generer-images.mjs');
}

/* ---------- Ce qui n'appartient pas au code ----------
   v7 — les attentes étaient documentées, mais CHACUNE DANS SON COIN :
   les sept champs dans mentions-legales.html, la garantie de transfert
   dans confidentialite.html, le logo dans un commentaire au sommet de
   assets/logo.svg, le message vocal dans assets/audio/LISEZ-MOI.txt, et
   les variables du formulaire nulle part. Il fallait ouvrir cinq
   fichiers pour savoir ce qui restait à faire. Ce script est celui
   qu'on lance avant de mettre en ligne : c'est donc lui qui doit tout
   dire, y compris ce qu'il ne peut pas vérifier lui-même. */

{
  const logo = readFileSync(join(RACINE, 'assets', 'logo.svg'), 'utf8');
  if (/GABARIT|EMPLACEMENT DU LOGO/.test(logo)) {
    todo(
      'Le logo est encore le GABARIT livré avec le site.\n' +
        '     Remplacer assets/logo.svg par le vrai fichier — rien d\'autre à toucher.\n' +
        '     Si le rapport largeur/hauteur change, ajuster width/height sur les\n' +
        '     balises <img class="logo-mark"> (voir README §Logo).'
    );
  }

  const audio = ['accueil.m4a', 'accueil.mp3']
    .some((f) => existsSync(join(RACINE, 'assets', 'audio', f)));
  const branche = Object.values(html).some((src) => /<body[^>]*data-piece=/.test(src));
  if (!audio && !branche) {
    todo(
      'Le message vocal d\'accueil n\'est pas déposé (facultatif).\n' +
        '     Mode d\'emploi : assets/audio/LISEZ-MOI.txt. Tant qu\'il manque, le bloc\n' +
        '     reste masqué et AUCUNE requête n\'est faite — il n\'y a donc rien de cassé.'
    );
  } else if (audio && !branche) {
    ko(
      'Un fichier audio est déposé mais <body> ne porte pas data-piece :\n' +
        '     le message ne sera jamais joué. Voir assets/audio/LISEZ-MOI.txt.'
    );
  } else if (!audio && branche) {
    ko(
      '<body> porte data-piece mais aucun fichier audio n\'est déposé :\n' +
        '     le visiteur verra un bouton mort. Déposer le fichier ou retirer l\'attribut.'
    );
  }

  todo(
    'Le formulaire de contact n\'envoie rien tant que le projet Vercel n\'a pas ses\n' +
      '     variables : RESEND_API_KEY + CONTACT_TO, ou CONTACT_WEBHOOK_URL.\n' +
      '     Sans elles, la demande est acceptée, journalisée côté serveur… et perdue.\n' +
      '     Ce script ne peut pas le vérifier d\'ici : c\'est à contrôler dans Vercel.'
  );
}

/* ---------- Rapport ---------- */

console.log(`\n${pages.length} pages contrôlées.\n`);

if (erreurs.length) {
  console.log(`✗ ${erreurs.length} ERREUR(S)\n`);
  for (const e of erreurs) console.log(`  • ${e}`);
  console.log('');
} else {
  console.log('✓ Aucune erreur.\n');
}

if (aFaire.length) {
  console.log(`⚠ ${aFaire.length} POINT(S) À FAIRE AVANT LA MISE EN LIGNE PUBLIQUE\n`);
  for (const t of aFaire) console.log(`  • ${t}`);
  console.log('');
}

process.exit(erreurs.length ? 1 : aFaire.length ? 2 : 0);
