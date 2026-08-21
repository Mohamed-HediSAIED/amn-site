#!/usr/bin/env node
/* ------------------------------------------------------------------
   Génère les images du site à partir de gabarits HTML rendus dans un
   vrai navigateur, avec les VRAIES polices du site :

     assets/favicon-32.png        onglet du navigateur
     assets/apple-touch-icon.png  écran d'accueil iOS (180)
     assets/icon-512.png          grande taille / JSON-LD
     assets/og.png                aperçu de partage 1200×630

   Passer par le navigateur plutôt que par un SVG évite le piège
   classique : un SVG qui contient du <text> dépend d'une police
   installée sur la machine qui l'affiche, et retombe sur autre chose
   ailleurs. Ici le texte est rendu une fois et figé en pixels.

   ⚠ LE GABARIT CI-DESSOUS EST DU CONTENU, PAS DE L'OUTILLAGE. Il porte
   le titre de l'accueil et les couleurs de la charte. Il était resté
   figé à la v1 pendant huit versions : l'aperçu de partage montrait
   encore l'ancien titre et l'AMBRE #ffb224, la couleur qu'Aaron avait
   fait retirer de tout le site en v6. Le contrôle « monochrome » ne
   l'avait jamais vu parce qu'il lit les couleurs calculées du DOM, et
   qu'une image est opaque à ce genre de mesure.

   Depuis, verifier-signes-ia.mjs ÉCHANTILLONNE LES PIXELS de og.png et
   refuse toute couleur saturée. Si tu changes le titre de l'accueil,
   change-le ici aussi et relance ce script.

     node scripts/generer-images.mjs
   ------------------------------------------------------------------ */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { demarrer } from './serveur-local.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function chargerPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try {
      return require(p);
    } catch {
      /* essai suivant */
    }
  }
  throw new Error("Playwright introuvable. Installer : npm i -D playwright && npx playwright install chromium");
}

const POLICES = `
<link rel="stylesheet" href="/assets/fonts.css">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%}
  body{background:#0a0a0a;font-family:'Space Grotesk',sans-serif;-webkit-font-smoothing:antialiased}
  /* Spectral porte les titres du site depuis la v9 : l'aperçu de
     partage doit montrer la même typographie que la page. */
</style>`;

/* --- Monogramme carré, repris de LogoMark côté produit --- */
const icone = (taille, degrade) => `<!doctype html><html><head><meta charset="utf-8">${POLICES}
<style>
  body{display:grid;place-items:center;background:transparent}
  .m{
    width:${taille}px;height:${taille}px;
    background:#131313;
    border:${Math.max(1, Math.round(taille * 0.037))}px solid #2a2a2a;
    border-radius:${Math.round(taille * 0.225)}px;
    display:grid;place-items:center;
  }
  .a{
    font-size:${Math.round(taille * 0.62)}px;
    font-weight:700;
    letter-spacing:-.04em;
    line-height:1;
    padding-bottom:${Math.round(taille * 0.03)}px;
    ${
      degrade
        ? `background:linear-gradient(45deg,#616160 0%,#b6b6b3 50%,#ffffff 100%);
           -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;`
        : 'color:#f2f2f0;'
    }
  }
</style></head><body><div class="m"><span class="a">A</span></div></body></html>`;

/* --- Aperçu de partage 1200×630 --- */
const og = `<!doctype html><html><head><meta charset="utf-8">${POLICES}
<style>
  body{width:1200px;height:630px;padding:56px;display:flex}
  .carte{
    flex:1;background:#131313;border:1px solid #262626;border-radius:16px;
    padding:56px 60px;display:flex;flex-direction:column;justify-content:space-between;
    position:relative;
  }
  .marque{display:flex;flex-direction:column;gap:3px;line-height:1}
  .mot{
    font-size:40px;font-weight:700;letter-spacing:-.055em;
    background:linear-gradient(90deg,#8f8f8c 0%,#d2d2cf 52%,#ffffff 100%);
    -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
  }
  .sub{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:500;letter-spacing:.46em;color:#616160;padding-left:2px}
  h1{
    font-family:Spectral,Georgia,serif;
    font-size:62px;font-weight:600;letter-spacing:-.02em;line-height:1.1;
    color:#ededed;max-width:19ch;
  }
  h1 em{
    font-style:normal;
    text-decoration:underline;text-decoration-color:#5a5a58;
    text-decoration-thickness:3px;text-underline-offset:.14em;
    text-decoration-skip-ink:none;
  }
  .pied{
    font-family:'JetBrains Mono',monospace;font-size:17px;font-weight:500;
    letter-spacing:.12em;text-transform:uppercase;color:#9a9a97;
    border-top:1px solid #262626;padding-top:22px;
  }
</style></head><body>
  <div class="carte">
    <div class="marque"><span class="mot">AMN</span><span class="sub">DEVSEC</span></div>
    <h1>Votre activité dans <em>un seul outil</em>, surveillé par nous.</h1>
    <p class="pied">Poste de travail et supervision de sécurité</p>
  </div>
</body></html>`;

const { chromium } = chargerPlaywright();
const serveur = await demarrer({ port: 4179, silencieux: true });
const navigateur = await chromium.launch();

async function rendre(html, largeur, hauteur, sortie, transparent = false) {
  const page = await navigateur.newPage({
    viewport: { width: largeur, height: hauteur },
    deviceScaleFactor: 1
  });
  /* Passe par le serveur local : les @font-face se chargent en http,
     ce que Chromium refuse depuis file://. */
  await page.route('**/gabarit', (r) =>
    r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html })
  );
  await page.goto('http://localhost:4179/gabarit');
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ omitBackground: transparent });
  writeFileSync(join(RACINE, sortie), png);
  console.log(`  ${sortie}  ${largeur}×${hauteur}  ${(png.length / 1024).toFixed(1)} Ko`);
  await page.close();
}

await rendre(icone(512, true), 512, 512, 'assets/icon-512.png', true);
await rendre(icone(180, true), 180, 180, 'assets/apple-touch-icon.png', true);
await rendre(icone(32, false), 32, 32, 'assets/favicon-32.png', true);
await rendre(og, 1200, 630, 'assets/og.png');

await navigateur.close();
serveur.close();
console.log('\n✓ Images générées.');
