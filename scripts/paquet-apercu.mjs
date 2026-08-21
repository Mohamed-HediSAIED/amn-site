#!/usr/bin/env node
/* ------------------------------------------------------------------
   UN SEUL FICHIER, TOUT LE SITE.

   Le site n'est pas déployé : ni Mohamed ni le studio n'ont encore la
   main sur Vercel. Pour qu'il soit quand même OUVRABLE sur un
   téléphone, ce script emballe les neuf pages, la feuille de style,
   le script, les trois polices et les images dans un seul fichier
   HTML autonome — aucune requête réseau une fois chargé.

   Ce n'est pas le site déployé, c'est une COPIE. Deux différences, et
   elles sont écrites dans le bandeau d'aperçu :
     - le formulaire ne peut rien envoyer (il n'y a pas de serveur) ;
     - l'adresse dans la barre du navigateur ne change pas de page.

   Tout le reste — mise en page, polices, navigation, dépliables,
   questions fréquentes — est le contenu réel, tel quel.

     node scripts/paquet-apercu.mjs [fichier-de-sortie]
   ------------------------------------------------------------------ */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE = process.argv[2] || join(RACINE, '.apercu.html');

const TYPES = {
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
};

const cache = new Map();
function donnee(chemin) {
  if (cache.has(chemin)) return cache.get(chemin);
  const abs = join(RACINE, chemin.replace(/^\//, ''));
  const type = TYPES[extname(chemin).toLowerCase()];
  if (!type) throw new Error(`type inconnu pour ${chemin}`);
  const uri = `data:${type};base64,${readFileSync(abs).toString('base64')}`;
  cache.set(chemin, uri);
  return uri;
}

/* ---- La feuille de style, polices comprises ---- */
let css = readFileSync(join(RACINE, 'assets', 'fonts.css'), 'utf8')
  .replace(/url\('fonts\/([^']+)'\)/g, (_, f) => `url('${donnee('/assets/fonts/' + f)}')`);
css += '\n' + readFileSync(join(RACINE, 'site.css'), 'utf8')
  .replace(/url\('(\/assets\/[^']+)'\)/g, (_, f) => `url('${donnee(f)}')`);

/* ---- Le script du site, rendu ré-appelable ---- */
const js = readFileSync(join(RACINE, 'site.js'), 'utf8')
  .replace(/\(function \(\) \{/, 'window.AMN_INIT = function () {')
  .replace(/\}\)\(\);\s*$/, '};\n');

/* ---- Les neuf pages ---- */
const pages = {};
for (const f of readdirSync(RACINE).filter((x) => x.endsWith('.html')).sort()) {
  const src = readFileSync(join(RACINE, f), 'utf8');
  const chemin = f === 'index.html' ? '/' : '/' + f.replace(/\.html$/, '');
  let corps = src.slice(src.indexOf('>', src.indexOf('<body')) + 1, src.lastIndexOf('</body>'));
  corps = corps
    .replace(/<script[^>]*><\/script>/g, '')
    .replace(/(?:src|srcset)="([^"]*\/assets\/[^"]*)"/g, (m, v) =>
      m.replace(v, v.replace(/\/assets\/[a-zA-Z0-9@._-]+/g, (a) => donnee(a))))
    .replace(/<!--[\s\S]*?-->/g, '');
  pages[chemin] = {
    titre: (src.match(/<title>([^<]*)<\/title>/) || [])[1] || 'AMN DevSec',
    corps,
  };
}

/* Le <title> doit être la PREMIÈRE chose du fichier : l'hébergeur ne
   lit que les 8 premiers Ko pour le trouver, et la feuille de style
   qui suit pèse à elle seule plus de cent Ko de polices intégrées. */
const enveloppe = `<title>AMN DevSec</title>
<style>
${css}
/* ---- Le bandeau d'aperçu : il n'appartient pas au site ---- */
#apercu-bandeau{position:fixed;left:0;right:0;bottom:0;z-index:400;display:flex;gap:12px;
  align-items:center;justify-content:center;flex-wrap:wrap;
  padding:9px 14px;background:#ededed;color:#0a0a0a;
  font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;line-height:1.5;
  letter-spacing:.02em;text-align:center}
#apercu-bandeau b{font-weight:600}
#apercu-bandeau button{font:inherit;font-weight:600;cursor:pointer;
  background:#0a0a0a;color:#ededed;border:0;border-radius:6px;padding:5px 11px}
body.apercu-ouvert{padding-bottom:64px}
@media print{#apercu-bandeau{display:none}}
</style>
<div id="ecran"></div>
<div id="apercu-bandeau" hidden>
  <span><b>Copie d'aperçu</b> — le site n'est pas encore déployé. Le formulaire ne peut rien envoyer.</span>
  <button type="button" id="apercu-ok">Compris</button>
</div>
<script>
${js}
(function () {
  var PAGES = ${JSON.stringify(pages)};
  var ecran = document.getElementById('ecran');
  var bandeau = document.getElementById('apercu-bandeau');

  function afficher(chemin, remonter) {
    var p = PAGES[chemin] || PAGES['/404'] || PAGES['/'];
    ecran.innerHTML = p.corps;
    document.title = p.titre;
    if (remonter) window.scrollTo(0, 0);
    try { window.AMN_INIT(); } catch (e) { /* une page sans interaction */ }
    if (location.hash.slice(1) !== chemin) {
      history.pushState({ p: chemin }, '', '#' + chemin);
    }
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) !== '/') return;      /* ancres et liens externes : inchangés */
    e.preventDefault();
    afficher(href.split('#')[0] || '/', true);
    var ancre = href.split('#')[1];
    if (ancre) {
      var cible = document.getElementById(ancre);
      if (cible) cible.scrollIntoView({ behavior: 'smooth' });
    }
  }, true);

  window.addEventListener('popstate', function () {
    /* Filet : si la page hôte n'a pas posé de meta viewport, le rendu
     mobile serait celui d'un écran de bureau réduit. */
  if (!document.querySelector('meta[name="viewport"]')) {
    var mv = document.createElement('meta');
    mv.name = 'viewport';
    mv.content = 'width=device-width, initial-scale=1';
    document.head.appendChild(mv);
  }

  afficher(location.hash.slice(1) || '/', false);
  });

  afficher(location.hash.slice(1) || '/', false);

  /* Le bandeau ne s'affiche qu'une fois par visite. */
  try {
    if (sessionStorage.getItem('amn-apercu-vu') !== '1') {
      bandeau.hidden = false;
      document.body.classList.add('apercu-ouvert');
    }
  } catch (e) {
    bandeau.hidden = false;
    document.body.classList.add('apercu-ouvert');
  }
  document.getElementById('apercu-ok').addEventListener('click', function () {
    bandeau.hidden = true;
    document.body.classList.remove('apercu-ouvert');
    try { sessionStorage.setItem('amn-apercu-vu', '1'); } catch (e) { /* refusé */ }
  });
})();
</script>
`;

writeFileSync(SORTIE, enveloppe);
const ko = statSync(SORTIE).size / 1024;
console.log(`\n${SORTIE}`);
console.log(`  ${Object.keys(pages).length} pages · ${cache.size} fichiers intégrés · ${ko.toFixed(0)} Ko\n`);
