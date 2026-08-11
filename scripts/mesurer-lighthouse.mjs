#!/usr/bin/env node
/* ------------------------------------------------------------------
   Mesure de performance RÉELLE — Lighthouse, mobile et ordinateur,
   contre le serveur local (qui sert les vrais fichiers avec les vraies
   en-têtes). Ce n'est pas une estimation : c'est un vrai Chromium,
   avec la bridation processeur et réseau du préréglage mobile.

   Lighthouse n'est pas une dépendance du site : rien n'est ajouté au
   dépôt, il est appelé depuis une installation à part.

     npm i --no-save --prefix /tmp/lh lighthouse
     node scripts/mesurer-lighthouse.mjs

   Variables : LIGHTHOUSE_DIR (défaut /tmp/lh), CHROME_PATH.
   ------------------------------------------------------------------ */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { demarrer } from './serveur-local.mjs';

const PORT = 4188;
const BASE = `http://localhost:${PORT}`;
const PAGES = ['/', '/service', '/methode', '/prix', '/a-propos', '/contact'];

const LH_DIR = process.env.LIGHTHOUSE_DIR || '/tmp/lh';
const lhEntree = `${LH_DIR}/node_modules/lighthouse/core/index.js`;
if (!existsSync(lhEntree)) {
  console.error(`Lighthouse introuvable dans ${LH_DIR}.\n  npm i --no-save --prefix ${LH_DIR} lighthouse`);
  process.exit(1);
}

const require = createRequire(import.meta.url);
const lighthouse = (await import(pathToFileURL(lhEntree).href)).default;
const chromeLauncher = await import(
  pathToFileURL(`${LH_DIR}/node_modules/chrome-launcher/dist/index.js`).href
);

const CHROME =
  process.env.CHROME_PATH ||
  ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(
    existsSync
  );

const serveur = await demarrer({ port: PORT, silencieux: true });
const chrome = await chromeLauncher.launch({
  chromePath: CHROME,
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage']
});

const n = (v) => (v === null || v === undefined ? '—' : Math.round(v));
const ms = (v) => (v === null || v === undefined ? '—' : `${Math.round(v)} ms`);

for (const forme of ['mobile', 'desktop']) {
  console.log(`\n${'═'.repeat(74)}\n  ${forme.toUpperCase()}\n${'═'.repeat(74)}`);
  console.log(
    `${'Page'.padEnd(12)}${'Perf'.padStart(6)}${'A11y'.padStart(6)}${'BP'.padStart(6)}${'SEO'.padStart(6)}` +
      `${'FCP'.padStart(11)}${'LCP'.padStart(11)}${'TBT'.padStart(10)}${'CLS'.padStart(8)}${'Poids'.padStart(10)}`
  );

  const config =
    forme === 'desktop'
      ? (await import(pathToFileURL(`${LH_DIR}/node_modules/lighthouse/core/config/desktop-config.js`).href))
          .default
      : undefined;

  for (const chemin of PAGES) {
    /* Une exécution Lighthouse échoue de temps en temps sans rien avoir
       à voir avec la page (délai du protocole de débogage). Un score
       de 0 sans aucune métrique, c'est une mesure ratée, pas une page
       lente : on relance plutôt que de publier un chiffre faux. */
    let l = null;
    for (let essai = 1; essai <= 3; essai++) {
      const r = await lighthouse(BASE + chemin, { port: chrome.port, output: 'json', logLevel: 'error' }, config);
      l = r.lhr;
      if (!l.runtimeError && l.audits['first-contentful-paint']?.numericValue) break;
      if (essai < 3) console.log(`  (${chemin} : mesure ratée, essai ${essai + 1}/3)`);
    }
    const a = l.audits;
    const c = (id) => n(l.categories[id]?.score * 100);
    const poids = a['total-byte-weight']?.numericValue;
    console.log(
      `${chemin.padEnd(12)}${String(c('performance')).padStart(6)}${String(c('accessibility')).padStart(6)}` +
        `${String(c('best-practices')).padStart(6)}${String(c('seo')).padStart(6)}` +
        `${ms(a['first-contentful-paint']?.numericValue).padStart(11)}` +
        `${ms(a['largest-contentful-paint']?.numericValue).padStart(11)}` +
        `${ms(a['total-blocking-time']?.numericValue).padStart(10)}` +
        `${(a['cumulative-layout-shift']?.numericValue ?? 0).toFixed(3).padStart(8)}` +
        `${(poids ? (poids / 1024).toFixed(0) + ' Ko' : '—').padStart(10)}`
    );
  }
}

await chrome.kill();
serveur.close();
console.log('\nMesuré dans un vrai Chromium. Le préréglage mobile bride le');
console.log('processeur (×4) et le réseau (4G lente) — pas la machine de test.\n');
