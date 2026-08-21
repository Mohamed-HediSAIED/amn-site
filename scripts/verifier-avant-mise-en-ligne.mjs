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
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
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

/* Le MODE, lu une fois et tout de suite : il conditionne la sévérité de
   plusieurs contrôles plus bas. Déclaré ici et pas à l'endroit où il
   sert d'abord — une constante employée avant sa ligne de déclaration
   lève une ReferenceError, et c'est exactement ce qui est arrivé en
   l'écrivant. Interrupteur : node scripts/preversion.mjs on|off */
const preversion = JSON.parse(readFileSync(join(RACINE, 'vercel.json'), 'utf8'))
  .headers.some((b) => b.headers.some((h) => h.key === 'X-Robots-Tag' && /noindex/.test(h.value)));

console.log(preversion
  ? '\n▪ Mode PRÉVERSION — le site n\'est pas indexable.'
  : '\n▪ Mode PUBLIC — le site est indexable.');
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
  /* En préversion tout le site est en noindex ET robots.txt ne déclare
     plus le plan : la présence d'une URL dans sitemap.xml n'est plus une
     contradiction, c'est un fichier que plus rien ne désigne. En mode
     public, l'incohérence redevient une erreur. */
  if (!indexable && dansSitemap.has(url) && !preversion) {
    ko(`${f} est en noindex mais présente dans sitemap.xml.`);
  }
}
for (const url of dansSitemap) {
  if (!url.startsWith(origine)) ko(`sitemap.xml : « ${url} » n'est pas sur ${origine}.`);
}

const robots = readFileSync(join(RACINE, 'robots.txt'), 'utf8');
if (preversion) {
  /* En préversion, robots.txt ne DOIT PAS déclarer le plan du site :
     désigner une liste d'URLs qu'on interdit par ailleurs d'explorer et
     d'indexer serait se contredire. L'erreur s'inverse donc. */
  if (robots.includes('sitemap.xml')) {
    ko('robots.txt déclare encore le plan du site alors que la préversion est active.\n' +
       '     Rétablir :  node scripts/preversion.mjs on');
  }
  if (!/^Disallow:\s*\/\s*$/m.test(robots)) {
    ko('Préversion active mais robots.txt n\'interdit pas l\'exploration.\n' +
       '     Rétablir :  node scripts/preversion.mjs on');
  }
} else if (!robots.includes(`${origine}/sitemap.xml`)) {
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

/* ---------- 5. Ce qui reste à faire ----------
   La sévérité dépend du MODE. Tant que la structure n'est pas
   immatriculée, le site part en préversion non indexable : des mentions
   légales vides y sont normales, on les rappelle sans bloquer. En mode
   public elles deviennent une ERREUR — un site professionnel indexé
   sans mentions légales n'est pas une négligence de finition, c'est un
   manquement. Le contrôle doit refuser de passer.
   Interrupteur : node scripts/preversion.mjs on|off */


if (origine.endsWith('.example')) {
  (preversion ? todo : ko)(
    `Le site pointe encore sur l'adresse de gabarit ${origine}.\n` +
      '     Après le premier déploiement :  node scripts/definir-domaine.mjs https://ADRESSE-REELLE'
  );
}

for (const [f, src] of Object.entries(html)) {
  const n = (src.match(/class="todo"/g) || []).length;
  if (!n) continue;
  if (preversion) {
    todo(`${f} : ${n} mention(s) « à compléter » — normal en préversion, à remplir avant l'ouverture.`);
  } else {
    ko(
      `${f} : ${n} mention(s) « à compléter » sur un site INDEXABLE.\n` +
        "     Remplir les champs, ou repasser en préversion :  node scripts/preversion.mjs on"
    );
  }
}

/* Longueur des métadonnées. Un titre trop long est coupé au milieu dans
   les résultats de recherche et dans l'aperçu de partage ; une
   description trop longue l'est aussi. Les pages en noindex sont hors
   sujet : elles ne paraîtront jamais dans un résultat. */
for (const [f, src] of Object.entries(html)) {
  /* Écarter « toutes les pages en noindex » aurait été juste en mode
     public et VIDE en préversion, où le mode met justement TOUTES les
     pages en noindex : le contrôle n'aurait rien regardé pendant tout
     le temps où il sert. La 404 est la seule page à écarter — elle est
     en noindex pour sa propre raison, et le restera. */
  if (f === '404.html') continue;
  const titre = (src.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const desc = (src.match(/name="description" content="([^"]*)"/) || [])[1] || '';
  if (titre.length > 62) todo(`${f} : titre de ${titre.length} caractères — coupé au-delà de ~60.`);
  if (desc.length > 160) todo(`${f} : description de ${desc.length} caractères — coupée au-delà de ~160.`);
  if (desc.length < 70) todo(`${f} : description de ${desc.length} caractères — trop courte pour dire quelque chose.`);
  /* Le titre de l'onglet et celui du partage disaient deux choses
     différentes sur l'accueil — « supervisée » d'un côté, « supervisé »
     de l'autre. Personne ne lit les deux côte à côte. */
  const ogT = (src.match(/property="og:title" content="([^"]*)"/) || [])[1];
  if (ogT && ogT !== titre) ko(`${f} : <title> et og:title diffèrent.\n     titre  : ${titre}\n     og     : ${ogT}`);
  const ogD = (src.match(/property="og:description" content="([^"]*)"/) || [])[1];
  if (ogD && ogD.length > 200) todo(`${f} : og:description de ${ogD.length} caractères.`);
}

/* Le plan du site datait faux : sept entrées figées au 11 août alors
   que les huit pages avaient été réécrites depuis, et une huitième sans
   date du tout. Un moteur qui lit une date ancienne ne revient pas. */
{
  const sm = readFileSync(join(RACINE, 'sitemap.xml'), 'utf8');
  const perimees = [];
  for (const bloc of sm.match(/<url>[\s\S]*?<\/url>/g) || []) {
    const loc = (bloc.match(/<loc>([^<]+)<\/loc>/) || [])[1] || '';
    const chemin = new URL(loc).pathname;
    const fichier = chemin === '/' ? 'index.html' : chemin.replace(/^\//, '') + '.html';
    const annonce = (bloc.match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1];
    let reel = null;
    try {
      reel = execFileSync('git', ['log', '-1', '--format=%cs', '--', fichier],
        { cwd: RACINE, encoding: 'utf8' }).trim();
    } catch { /* hors dépôt git : on ne peut rien dire */ }
    if (!reel) continue;
    if (!annonce) perimees.push(`${fichier} : aucune date`);
    else if (annonce < reel) perimees.push(`${fichier} : annonce ${annonce}, modifiée le ${reel}`);
  }
  if (perimees.length) {
    todo(
      `Le plan du site date faux sur ${perimees.length} entrée(s) :\n     ` +
        perimees.join('\n     ') +
        '\n     Corriger :  node scripts/dater-sitemap.mjs'
    );
  }
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

  /* La capture du produit est une VRAIE copie d'écran de
     l'application, ce qui est tout l'intérêt. Elle porte donc les
     données de test qui étaient à l'écran ce jour-là — « Site de
     test », la même note écrite deux fois, un prénom. Ça se voit, et
     ça se refait en dix minutes avec un jeu de données présentable. */
  if (existsSync(join(RACINE, 'assets', 'produit-registre.jpg'))) {
    todo(
      'La capture du produit montre les données de TEST de l\'application.\n' +
        '     On y lit « Site de test », une note en double et un prénom. Refaire la\n' +
        '     capture avec un jeu de données présentable avant l\'ouverture publique,\n' +
        '     puis relancer :  node scripts/verifier-signes-ia.mjs'
    );
  }

  /* Le signe de crédibilité le plus cité dans les inventaires de sites
     fabriqués par une IA : personne n'est nommé. Le code ne peut pas
     inventer un nom, mais il peut refuser d'oublier la question. */
  if (!Object.values(html).some((src) => /class="[^"]*signature/.test(src))) {
    todo(
      'Aucune personne n\'est nommée sur le site.\n' +
        '     C\'est le manque de crédibilité le plus souvent relevé sur les sites\n' +
        '     d\'entreprise : ni nom, ni photo, ni adresse, ni date. Une signature sur\n' +
        '     la page À propos (prénom, rôle, et la ville) coûte une ligne et change\n' +
        '     ce qu\'un visiteur croit de la page.'
    );
  }

  /* Une dette qui appartient au PRODUIT, pas au site, mais que le site
     paie : sa promesse anti-verrouillage vaut ce que vaut l'export. */
  todo(
    "L'export du produit est PARTIEL (dette côté amn-desktop).\n" +
      '     src/lib/backup.ts ramène neuf collections sur la vingtaine que déclare\n' +
      '     SyncedCollection : ni les factures, ni l\'agenda, ni les notes, ni les\n' +
      '     médias, ni les rapports, ni les projets, ni le registre des sites.\n' +
      '     Le site a cessé de promettre une « copie complète » — mais c\'est\n' +
      '     l\'export qu\'il faudrait compléter, pas la phrase qu\'il fallait réduire.'
  );

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
    'Le formulaire de contact ne peut rien envoyer tant que le projet Vercel n\'a pas\n' +
      '     ses variables : RESEND_API_KEY + CONTACT_TO, ou CONTACT_WEBHOOK_URL.\n' +
      '     Rien n\'est perdu en silence — vérifié : sans canal, l\'API répond 503 et le\n' +
      '     visiteur lit « votre message n\'a pas été envoyé ». Mais le formulaire est\n' +
      '     alors visiblement hors service : à régler avant de montrer le site.\n' +
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
