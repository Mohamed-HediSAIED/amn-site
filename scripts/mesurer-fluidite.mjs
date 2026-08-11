#!/usr/bin/env node
/* ------------------------------------------------------------------
   Fluidité RÉELLE, processeur bridé.

   Lighthouse mesure la page telle qu'elle se charge — donc la console
   FERMÉE. C'est le bon chiffre pour le visiteur qui arrive, mais il ne
   dit rien de ce qui coûte : l'ouverture de la console, et l'inclinaison
   au pointeur.

   Ici on bride le processeur (×6, l'ordre de grandeur d'un téléphone
   milieu de gamme face à un poste de développement — Lighthouse mobile
   se contente de ×4), puis on mesure l'intervalle entre images pendant
   chaque geste. Une image qui dépasse 32 ms, c'est une image sautée à
   60 Hz ; c'est ça, « ça rame ».

     node scripts/mesurer-fluidite.mjs [bridage]
   ------------------------------------------------------------------ */
import { createRequire } from 'node:module';
import { demarrer } from './serveur-local.mjs';

const require = createRequire(import.meta.url);
const PORT = 4187;
const BASE = `http://localhost:${PORT}`;
const BRIDAGE = Number(process.argv[2]) || 6;

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

const { chromium } = chargerPlaywright();
const serveur = await demarrer({ port: PORT, silencieux: true });
const navigateur = await chromium.launch();

/* Le collecteur : intervalle entre images + tâches longues du fil
   principal. Posé une fois, remis à zéro avant chaque geste. */
const POSER = () => {
  window.__img = [];
  window.__longues = 0;
  try {
    new PerformanceObserver((l) => {
      window.__longues += l.getEntries().length;
    }).observe({ entryTypes: ['longtask'] });
  } catch {
    /* navigateur sans longtask : on garde les intervalles */
  }
  let precedent = performance.now();
  const tic = (t) => {
    window.__img.push(t - precedent);
    precedent = t;
    requestAnimationFrame(tic);
  };
  requestAnimationFrame(tic);
};

const lignes = [];
const REPETITIONS = 3;

/* Trois passes, et on met TOUTES les images en commun. Une seule passe
   donne une pire-image qui varie du simple au double d'une exécution à
   l'autre — publier ce chiffre-là, ce serait publier du bruit. */
async function mesurer(nom, largeur, geste) {
  const toutes = [];
  let longues = 0;

  for (let essai = 0; essai < REPETITIONS; essai++) {
    const page = await navigateur.newPage({ viewport: { width: largeur, height: 844 } });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: BRIDAGE });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.evaluate(POSER);
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      window.__img.length = 0;
      window.__longues = 0;
    });

    await geste(page);

    const brut = await page.evaluate(() => ({ img: window.__img, longues: window.__longues }));
    toutes.push(...brut.img);
    longues += brut.longues;
    await page.close();
  }

  const v = toutes.sort((a, b) => a - b);
  const q = (p) => (v.length ? v[Math.min(v.length - 1, Math.floor(v.length * p))] : 0);
  lignes.push([
    nom,
    largeur,
    {
      images: v.length,
      median: q(0.5),
      p95: q(0.95),
      max: v.length ? v[v.length - 1] : 0,
      sautees: v.filter((x) => x > 32).length,
      longues
    }
  ]);
}

/* 1. Défilement de la page — le geste le plus fréquent, et celui que le
      flou d'arrière-plan du bandeau de la v1 rendait cher. */
await mesurer('Défilement de l’accueil', 390, async (page) => {
  for (let i = 0; i < 22; i++) {
    await page.mouse.wheel(0, 260);
    await page.waitForTimeout(55);
  }
});

/* 2. Ouverture de la console : la séquence complète (fond, balayage,
      arrivée décalée des cinq plaques). */
for (const largeur of [390, 1440]) {
  await mesurer('Ouverture de la console', largeur, async (page) => {
    await page.locator('.console > summary').click();
    await page.waitForTimeout(1300);
  });
}

/* 3. Inclinaison au pointeur, en continu. Le seul geste qui écrit dans
      le style à chaque image — donc celui qui pourrait coûter. */
await mesurer('Parallaxe au pointeur', 1440, async (page) => {
  await page.locator('.console > summary').click();
  await page.waitForTimeout(900);
  for (let i = 0; i < 40; i++) {
    await page.mouse.move(300 + ((i * 47) % 900), 200 + ((i * 31) % 500));
    await page.waitForTimeout(28);
  }
});

await navigateur.close();
serveur.close();

console.log(`\nProcesseur bridé ×${BRIDAGE}. Une image > 32 ms = une image sautée à 60 Hz.\n`);
console.log(
  `${'Geste'.padEnd(26)}${'Largeur'.padStart(8)}${'Images'.padStart(8)}${'Médiane'.padStart(10)}` +
    `${'p95'.padStart(9)}${'Pire'.padStart(9)}${'Sautées'.padStart(9)}${'Tâches longues'.padStart(16)}`
);
console.log('─'.repeat(95));
for (const [nom, largeur, s] of lignes) {
  console.log(
    `${nom.padEnd(26)}${(largeur + 'px').padStart(8)}${String(s.images).padStart(8)}` +
      `${(s.median.toFixed(1) + ' ms').padStart(10)}${(s.p95.toFixed(1) + ' ms').padStart(9)}` +
      `${(s.max.toFixed(0) + ' ms').padStart(9)}${String(s.sautees).padStart(9)}${String(s.longues).padStart(16)}`
  );
}
console.log('');
