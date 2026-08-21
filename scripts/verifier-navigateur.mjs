#!/usr/bin/env node
/* ------------------------------------------------------------------
   Vérification dans un vrai navigateur (Chromium via Playwright).

   Ce que ça contrôle réellement, pas « en principe » :
     1. les 9 pages à 5 largeurs — aucune erreur de console, aucune
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
import { readdirSync, readFileSync } from 'node:fs';
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
      /* Les DEUX polices du PRODUIT. Si l'une retombe sur une police
         système, la parenté avec l'application disparaît sans qu'aucun
         autre contrôle ne s'en aperçoive. */
      const polices = await page.evaluate(() => ({
        sg: document.fonts.check('600 16px "Space Grotesk"'),
        jb: document.fonts.check('400 12px "JetBrains Mono"'),
        sp: document.fonts.check('600 32px Spectral'),
        h1: getComputedStyle(document.querySelector('h1')).fontFamily,
        corps: getComputedStyle(document.body).fontFamily
      }));
      t(`${chemin} — Space Grotesk chargée`, polices.sg);
      t(`${chemin} — JetBrains Mono chargée`, polices.jb);
      t(`${chemin} — Spectral chargée`, polices.sp);
      /* Le partage des rôles : le titre parle au nom du SITE, le texte
         courant cite le PRODUIT. Space Grotesk en gros titre est
         devenue l'un des signes qui trahissent un site fabriqué par une
         IA ; elle reste partout ailleurs, où c'est la police du
         produit qui a un sens. */
      t(`${chemin} — le titre est en Spectral`,
        /Spectral/.test(polices.h1) && !/Space Grotesk/.test(polices.h1), polices.h1);
      t(`${chemin} — le texte courant reste en Space Grotesk`,
        /Space Grotesk/.test(polices.corps), polices.corps);

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

  const courante = await page.locator('.plaque[aria-current="page"]').count();
  t('La page courante est signalée dans la console', courante === 1, `trouvé ${courante}`);

  /* Ouverture AU CLAVIER, et pas au clic : `:focus-visible` ne se
     déclenche qu'en modalité clavier. Un `.focus()` posé après un clic
     de souris ne montrerait aucun anneau — et le contrôle passerait à
     côté de ce qu'il prétend vérifier. */
  await page.locator('.console > summary').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const anneau = await page.evaluate(() => {
    const a = document.activeElement;
    const s = getComputedStyle(a);
    return {
      ok: a.matches('.console-panel a') && s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2,
      quoi: `${a.tagName}.${a.className} outline=${s.outlineStyle} ${s.outlineWidth}`
    };
  });
  t('Anneau de focus visible sur les liens', anneau.ok, anneau.quoi);

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
    ['texte de suivi', '.watch li'],
    /* v6 — les nouveaux éléments entrent dans la boucle EN MÊME TEMPS
       qu'ils entrent dans la page. La v5 avait appris ça à ses dépens :
       la suite passait à 424 pendant que Lighthouse tombait à 96. */
    ['légende de la capture', '.capture figcaption']
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
    ['nom de module', '.mod-nom'],
    ['description de module', '.mod-txt'],
    ['numéro de module', '.mod-n'],
    ['intitulé de cadran', '.instr b'],
    ['texte de cadran', '.instr b + span']
  ],
  '/methode': [
    ['numéro d\'étape', '.steps .n'],
    ['encadré d\'étape', '.steps .aside']
  ],
  '/prix': [
    ['libellé de forfait', '.tarif > .mono'],
    ['pour qui', '.tarif-qui'],
    ['prix', '.tarif-prix b'],
    ['unité du prix', '.tarif-prix span'],
    ['ligne de forfait', '.tarif li'],
    ['prix mis en avant', '.tarif--phare .tarif-prix b'],
    ['texte de l\'option', '.option p'],
    ['pied de tableau', '.tarifs-pied p'],
    ['note en marge', '.note-marge']
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
/* ================= 2 bis. La console ================= */

console.log('2 bis. La console (navigation v2)');

const DESTINATIONS = ['/', '/service', '/methode', '/prix', '/a-propos', '/contact'];

/* Les plaques arrivent en décalé sur ~350 ms. Interroger leur position
   pendant ce temps donne des résultats faux (l'élément est encore en
   translation dans l'axe Z). On attend la fin des animations plutôt
   qu'un délai au jugé. */
const attendreArrivee = (page) =>
  page.evaluate(() =>
    Promise.all(
      [...document.querySelectorAll('.plaque')].flatMap((p) => p.getAnimations()).map((a) => a.finished)
    ).catch(() => {})
  );

/* Le contrat qui rend la v2 acceptable : chaque destination reste une
   URL qui répond seule. Si ceci casse, le site a cessé d'être un site. */
for (const chemin of DESTINATIONS) {
  const r = await fetch(BASE + chemin);
  const html = await r.text();
  t(`${chemin} — répond seule, sans passer par la console`, r.status === 200, String(r.status));
  t(`${chemin} — les 5 destinations sont dans le HTML SERVI (pas injectées)`,
    DESTINATIONS.every((d) => html.includes(`href="${d}"`)));
  t(`${chemin} — un seul logo dans l'en-tête, et c'est le fichier`,
    (html.match(/class="logo-mark" src="\/assets\/logo\.svg"/g) || []).length >= 1);
}

for (const largeur of [390, 1440]) {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: 900 } });
  const erreurs = [];
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  page.on('pageerror', (e) => erreurs.push(String(e)));
  await page.goto(BASE + '/service', { waitUntil: 'networkidle' });
  const et = `console @${largeur}`;

  t(`${et} — fermée au chargement`, !(await page.locator('.console').evaluate((d) => d.open)));

  /* Le point qui porte toute la performance : fermée, la console n'est
     pas rendue. Ni quadrillé, ni halo, ni plaques — le navigateur ne
     les met pas en page et ne les peint pas. */
  t(`${et} — contenu NON rendu tant qu'elle est fermée`,
    await page.evaluate(() =>
      ['.plaque', '.console-sol', '.console-halo'].every(
        (s) => document.querySelector(s).checkVisibility() === false
      )));

  await page.locator('.console > summary').click();
  await attendreArrivee(page);
  t(`${et} — ouverte au clic`, await page.locator('.console').evaluate((d) => d.open));
  t(`${et} — les six destinations sont visibles`,
    (await page.locator('.console-panel a[href]:visible').count()) === DESTINATIONS.length);
  t(`${et} — la page courante est marquée`,
    (await page.locator('.plaque[aria-current="page"]').count()) === 1);
  t(`${et} — le focus entre dans le panneau`,
    await page.evaluate(() => document.querySelector('.console-panel').contains(document.activeElement)));
  t(`${et} — le défilement de la page est bloqué`,
    (await page.evaluate(() => getComputedStyle(document.documentElement).overflow)) === 'hidden');
  t(`${et} — le reste de la page est rendu inerte`,
    await page.evaluate(() => document.getElementById('main').inert === true));

  await page.keyboard.press('Escape');
  t(`${et} — Échap referme`, !(await page.locator('.console').evaluate((d) => d.open)));
  t(`${et} — le focus revient sur le témoin`,
    (await page.evaluate(() => document.activeElement.tagName)) === 'SUMMARY');
  /* `inert` est reposé dans le gestionnaire de `toggle`, qui est mis en
     file d'attente : juste après Échap, `open` vaut déjà false mais le
     gestionnaire n'a pas encore tourné. On attend l'état, on ne dort
     pas un délai au hasard. */
  let rendu = true;
  await page
    .waitForFunction(() => document.getElementById('main').inert === false, null, { timeout: 3000 })
    .catch(() => (rendu = false));
  t(`${et} — la page redevient atteignable`, rendu);
  t(`${et} — le défilement est rendu`,
    (await page.evaluate(() => getComputedStyle(document.documentElement).overflow)) !== 'hidden');

  /* Le fond referme, les plaques non. */
  await page.locator('.console > summary').click();
  await attendreArrivee(page);
  await page.mouse.click(largeur - 12, 870);
  t(`${et} — un clic sur le fond referme`, !(await page.locator('.console').evaluate((d) => d.open)));

  /* Ouverture au clavier seul, puis navigation réelle vers une page —
     sans jamais toucher la souris. */
  await page.locator('.console > summary').focus();
  await page.keyboard.press('Enter');
  t(`${et} — s'ouvre au clavier (Entrée sur le témoin)`,
    await page.locator('.console').evaluate((d) => d.open));
  await attendreArrivee(page);
  t(`${et} — le focus est sur une destination`,
    await page.evaluate(() => document.activeElement.classList.contains('plaque')));
  let arrivee = true;
  await Promise.all([
    page.waitForURL(`${BASE}/`, { timeout: 5000 }).catch(() => (arrivee = false)),
    page.keyboard.press('Enter')
  ]);
  t(`${et} — Entrée sur une destination y mène vraiment`, arrivee, page.url());

  t(`${et} — console du navigateur propre pendant tout ça`, erreurs.length === 0, erreurs.join(' | '));
  await page.close();
}

{
  /* Sans JavaScript, la console reste utilisable : c'est tout l'intérêt
     d'un <details> plutôt que d'un panneau scripté. */
  const ctx = await navigateur.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 }
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(3700);   /* sans JS : 2,55 s de frappe + 0,75 s de sortie, plus une marge */
  await page.locator('.console > summary').click();
  t('Sans JavaScript : la console s\'ouvre', await page.locator('.plaque[href="/service"]').isVisible());
  /* Pas de page.evaluate ici : sans JavaScript il n'y a rien pour
     l'exécuter. On laisse l'arrivée des plaques se terminer au délai. */
  await page.waitForTimeout(700);
  let arriveeSansJs = true;
  await Promise.all([
    page.waitForURL(`${BASE}/service`, { timeout: 5000 }).catch(() => (arriveeSansJs = false)),
    page.locator('.plaque[href="/service"]').click()
  ]);
  t('Sans JavaScript : on arrive bien sur la page choisie', arriveeSansJs, page.url());
  await ctx.close();
}

{
  /* Inclinaison au pointeur : elle doit s'appliquer sur un poste qui
     survole… */
  const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 } });
  const erreurs = [];
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  page.on('pageerror', (e) => erreurs.push(String(e)));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.locator('.console > summary').click();
  await page.mouse.move(1360, 180);
  await page.waitForTimeout(250);
  const incline = await page.evaluate(() =>
    document.querySelector('.console-scene').style.getPropertyValue('--ry')
  );
  t('Parallaxe : la scène s\'incline au pointeur', parseFloat(incline) !== 0, `--ry = « ${incline} »`);
  t('Parallaxe : aucune erreur (la CSP n\'empêche pas l\'écriture CSSOM)',
    erreurs.length === 0, erreurs.join(' | '));

  const souleve = await page.evaluate(() => {
    const p = document.querySelector('.plaques > li:nth-child(3) .plaque');
    const avant = p.getBoundingClientRect().width;
    return { avant, style: getComputedStyle(p).transformStyle };
  });
  t('Le relief 3D n\'est pas aplati par un ancêtre',
    (await page.evaluate(() => getComputedStyle(document.querySelector('.plaques > li')).transformStyle)) ===
      'preserve-3d', souleve.style);
  await page.close();
}

{
  /* … et ne pas être installée du tout sur un écran tactile. */
  const ctx = await navigateur.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  t('Tactile : le navigateur n\'annonce pas de survol',
    !(await page.evaluate(() => window.matchMedia('(hover: hover) and (pointer: fine)').matches)));
  await page.locator('.console > summary').click();
  await page.waitForTimeout(150);
  t('Tactile : aucune parallaxe posée sur la scène',
    (await page.evaluate(() => document.querySelector('.console-scene').style.getPropertyValue('--ry'))) === '');
  t('Tactile : le balayage lumineux est retiré',
    (await page.evaluate(() => getComputedStyle(document.querySelector('.console-balai')).display)) === 'none');
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

  await page.locator('.console > summary').click();
  await page.waitForTimeout(120);
  t('Mouvement réduit : la console reste utilisable',
    (await page.locator('.console-panel a[href]:visible').count()) === 6);
  t('Mouvement réduit : la scène n\'est pas inclinée',
    (await page.evaluate(() => getComputedStyle(document.querySelector('.console-scene')).transform)) === 'none');
  t('Mouvement réduit : l\'arrivée des plaques est neutralisée',
    parseFloat(await page.evaluate(() =>
      getComputedStyle(document.querySelector('.plaque')).animationDuration)) < 0.01);
  await ctx.close();
}

/* ---- Contraste DANS la console, panneau ouvert ---- */
{
  const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.locator('.console > summary').click();
  await page.waitForTimeout(500);
  const mesures = await page.evaluate(() => {
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
    return [
      ['nom de destination', '.plaque-nom'],
      ['texte de destination', '.plaque-txt'],
      /* Sur une plaque QUI N'EST PAS la page courante : celle-ci passe
         son numéro en ambre, ce qui donnerait un rapport flatteur et
         ne mesurerait pas le cas ordinaire. */
      ['numéro de destination', '.plaques > li:nth-child(3) .plaque-n'],
      ['intitulé du panneau', '.console-tag'],
      ['rappel Échap', '.console-pied'],
      ['témoin de position', '.console > summary']
    ].map(([nom, sel]) => {
      const el = document.querySelector(sel);
      if (!el) return { nom, ratio: null };
      const s = getComputedStyle(el);
      const ratio =
        (Math.max(lum(nombres(s.color)), lum(fond(el))) + 0.05) /
        (Math.min(lum(nombres(s.color)), lum(fond(el))) + 0.05);
      const px = parseFloat(s.fontSize);
      const grand = px >= 24 || (px >= 18.66 && parseInt(s.fontWeight, 10) >= 700);
      return { nom, ratio: Math.round(ratio * 100) / 100, seuil: grand ? 3 : 4.5 };
    });
  });
  for (const m of mesures) {
    t(`Contraste console — ${m.nom}`, m.ratio !== null && m.ratio >= m.seuil,
      m.ratio === null ? 'élément absent' : `${m.ratio}:1 (minimum ${m.seuil}:1)`);
  }
  await page.close();
}

/* ---- La règle de section ---- */
{
  const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  t('Règle de section affichée sur grand écran', await page.locator('.rail').isVisible());

  const ancres = await page.evaluate(() =>
    [...document.querySelectorAll('.rail a')].map((a) => ({
      href: a.getAttribute('href'),
      cible: !!document.querySelector(a.getAttribute('href')),
      nom: a.textContent.trim()
    }))
  );
  /* Le compte était figé à cinq. Le jour où une section est retirée,
     un nombre en dur ne dit pas « la règle est fausse », il dit « le
     contrôle est périmé ». On compare donc le rail aux sections qui
     existent vraiment : c'est la propriété qu'on veut tenir. */
  const sections = await page.evaluate(() =>
    [...document.querySelectorAll('main > section[id]')].map((s) => '#' + s.id));
  t('Règle de section : au moins quatre repères', ancres.length >= 4, String(ancres.length));
  t('Règle de section : un repère par section, et pas un de plus',
    ancres.length === sections.length && sections.every((id) => ancres.some((a) => a.href.endsWith(id))),
    `rail ${ancres.map((a) => a.href.replace(/^.*#/, '#')).join(' ')} · sections ${sections.join(' ')}`);
  t('Règle de section : chaque repère vise une section existante', ancres.every((a) => a.cible),
    ancres.filter((a) => !a.cible).map((a) => a.href).join(', '));
  t('Règle de section : les liens ne s\'appellent pas juste « 01 »',
    ancres.every((a) => a.nom.replace(/[0-9\s]/g, '').length > 3), ancres.map((a) => a.nom).join(' | '));

  await page.evaluate(() => document.getElementById('parcours').scrollIntoView());
  await page.waitForTimeout(400);
  t('Règle de section : la section courante est signalée au défilement',
    (await page.locator('.rail a[href="#parcours"][aria-current="true"]').count()) === 1);

  /* Une ancre ne doit pas placer le titre derrière le bandeau collant. */
  await page.evaluate(() => (document.documentElement.scrollTop = 0));
  await page.locator('.rail a[href="#apercu"]').click();
  await page.waitForTimeout(300);
  const sousBandeau = await page.evaluate(() => {
    const h = document.querySelector('.hdr').getBoundingClientRect().bottom;
    return document.getElementById('parcours').getBoundingClientRect().top >= h - 1;
  });
  t('Règle de section : la cible ne passe pas sous le bandeau', sousBandeau);
  await page.close();
}
{
  const page = await navigateur.newPage({ viewport: { width: 1024, height: 900 } });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  t('Règle de section absente sous 1320 px', !(await page.locator('.rail').isVisible()));
  await page.close();
}

/* ================= 2 ter. v4 ================= */

console.log('2 ter. Dépliables et assistant');

/* ---- Le contenu dépliable ---- */
for (const chemin of ['/service', '/methode', '/confidentialite']) {
  const r = await fetch(BASE + chemin);
  const html = await r.text();
  t(`${chemin} — le détail replié est bien dans le HTML servi (indexable)`,
    html.includes('plus-corps') && html.indexOf('<div class="plus-corps">') < html.indexOf('</body>'));

  const page = await navigateur.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + chemin, { waitUntil: 'networkidle' });
  const n = await page.locator('details.plus').count();
  t(`${chemin} — au moins un bloc dépliable`, n >= 1, `trouvé ${n}`);
  t(`${chemin} — replié au chargement`,
    !(await page.locator('details.plus').first().evaluate((d) => d.open)));
  t(`${chemin} — le détail est masqué tant que c'est replié`,
    !(await page.locator('.plus-corps').first().isVisible()));
  await page.locator('details.plus summary').first().click();
  t(`${chemin} — le détail apparaît au clic`,
    await page.locator('.plus-corps').first().isVisible());
  await page.close();

  const ctx = await navigateur.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const p2 = await ctx.newPage();
  await p2.goto(BASE + chemin, { waitUntil: 'load' });
  await p2.locator('details.plus summary').first().click();
  t(`${chemin} — le dépliage fonctionne sans JavaScript`,
    await p2.locator('.plus-corps').first().isVisible());
  await ctx.close();
}

/* ---- L'assistant à réponses préparées ---- */
{
  const page = await navigateur.newPage({ viewport: { width: 1280, height: 900 } });
  const externes = [];
  const erreurs = [];
  page.on('request', (r) => {
    if (!r.url().startsWith(BASE) && !r.url().startsWith('data:')) externes.push(r.url());
  });
  page.on('pageerror', (e) => erreurs.push(String(e)));
  await page.goto(BASE + '/prix', { waitUntil: 'networkidle' });

  t('Assistant : replié au chargement', !(await page.locator('.ajm').evaluate((d) => d.open)));
  await page.locator('.ajm > summary').click();
  /* L'événement `toggle` d'un <details> est mis en file d'attente : le
     focus n'a pas encore bougé au retour du clic. On attend l'état, on
     ne dort pas un délai au hasard. */
  let focusChamp = true;
  await page
    .waitForFunction(() => document.activeElement && document.activeElement.id === 'ajm-q', null, { timeout: 3000 })
    .catch(() => (focusChamp = false));
  t('Assistant : le champ prend le focus à l\'ouverture', focusChamp);

  const demander = async (q) => {
    try { await page.fill('#ajm-q', q, { timeout: 4000 }); }
    catch (e) {
      const etat = await page.evaluate(() => {
        const d = document.querySelector('.ajm');
        const i = document.querySelector('#ajm-q');
        const r = i ? i.getBoundingClientRect() : null;
        return { open: d.open, rect: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null,
                 fenetre: [innerWidth, innerHeight], bulles: document.querySelectorAll('.ajm-bulle').length };
      });
      throw new Error('fill impossible sur « ' + q + ' » — ' + JSON.stringify(etat));
    }
    await page.locator('.ajm-form button[type="submit"]').click();
    await page.waitForTimeout(360);
    return page.evaluate(() => {
      const b = [...document.querySelectorAll('.ajm-bulle--lui')];
      return b[b.length - 1].textContent;
    });
  };

  /* Plusieurs formulations pour le même sujet doivent tomber au même
     endroit — c'est tout l'intérêt d'une reconnaissance par mots-clés
     plutôt que par phrase exacte. */
  for (const q of ['combien ça coûte ?', "c'est quoi vos tarifs", 'PRIX ?', 'quel est le cout']) {
    t(`Assistant : « ${q} » → les prix`, /35 €/.test(await demander(q)));
  }
  for (const q of ['vous surveillez quoi', 'la supervision porte sur quoi ?', 'vous controlez les certificats ?']) {
    t(`Assistant : « ${q} » → la supervision`, /disponibilit/i.test(await demander(q)));
  }

  const nature = await demander('es-tu une vraie IA ?');
  t('Assistant : honnête sur sa nature',
    /pr[ée]par[ée]/i.test(nature)
      && /(aucun mod[eè]l|pas un mod[eè]l|n'est pas un mod|invente)/i.test(nature),
    nature.slice(0, 90));

  const inconnu = await demander('quelle est la capitale de la Mongolie');
  t('Assistant : renvoie au formulaire quand il ne sait pas',
    /Demander un acc/i.test(inconnu) && /invent/i.test(inconnu), inconnu.slice(0, 90));

  /* Le point le plus important : ne JAMAIS improviser un engagement. */
  for (const q of ['y a-t-il un essai gratuit', 'quelle durée d\'engagement', 'je peux résilier quand ?']) {
    const rep = await demander(q);
    t(`Assistant : aucun engagement inventé sur « ${q} »`,
      /pas de r[ée]ponse pr[ée]par|Demander un acc/i.test(rep), rep.slice(0, 90));
  }

  const injection = await demander('<img src=x onerror=alert(1)>');
  t('Assistant : la question du visiteur n\'est pas interprétée comme du balisage',
    await page.evaluate(() => !document.querySelector('.ajm-fil img')), injection.slice(0, 60));

  t('Assistant : aucun appel réseau sortant', externes.length === 0, externes.join(' | '));
  t('Assistant : aucun cookie déposé',
    (await page.evaluate(() => document.cookie)) === '');
  t('Assistant : aucune erreur', erreurs.length === 0, erreurs.join(' | '));

  await page.keyboard.press('Escape');
  t('Assistant : Échap referme', !(await page.locator('.ajm').evaluate((d) => d.open)));
  await page.close();
}
{
  const ctx = await navigateur.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/prix', { waitUntil: 'load' });
  await page.locator('.ajm > summary').click();
  t('Assistant : sans JavaScript, il annonce la couleur',
    await page.locator('.ajm-sansjs').isVisible());
  await page.fill('#ajm-q', 'combien ça coûte');
  await Promise.all([page.waitForNavigation({ timeout: 5000 }), page.locator('.ajm-form button[type="submit"]').click()]);
  t('Assistant : sans JavaScript, le champ mène au formulaire',
    new URL(page.url()).pathname === '/contact', page.url());
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
    (await page.locator('.logo-mark').count()) === 1
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

/* 3.8 — message truffé de liens : MARQUÉ, PAS JETÉ.

   Il était jeté : réponse « c'est envoyé », et rien ne partait. Le seuil
   est à deux liens, or un artisan qui donne son site, sa boutique et le
   prestataire actuel en met trois — il disparaissait en lisant « votre
   demande est arrivée ». Le message est maintenant acheminé, étiqueté
   douteux ; la réponse au visiteur ne change pas, donc un robot
   n'apprend toujours rien. */
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
  t('Message truffé de liens : réponse identique au visiteur', r.status === 200);
  t('Message truffé de liens : acheminé quand même', recus.length === avant + 1,
    `${recus.length - avant} reçu(s)`);
  const dernier = recus[recus.length - 1];
  t('Message truffé de liens : étiqueté douteux',
    !!(dernier && dernier.douteux), JSON.stringify(dernier && dernier.douteux));
  t('Message truffé de liens : le texte est intact',
    !!(dernier && dernier.besoin && dernier.besoin.includes('d.example')));
}

/* 3.8 bis — trois liens, message parfaitement légitime : il DOIT arriver. */
contact.reinitialiserCompteurs();
{
  const avant = recus.length;
  const r = await fetch(`${BASE}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({
      nom: 'Claire Vasseur',
      structure: 'Atelier Vasseur',
      email: 'claire@atelier-vasseur.fr',
      besoin:
        'Bonjour, je suis ébéniste. Mon site est https://atelier-vasseur.fr, ma boutique ' +
        'https://boutique.atelier-vasseur.fr et mon prestataire actuel est https://exemple-hebergeur.fr. ' +
        "J'aimerais savoir si vous pouvez reprendre tout ça."
    })
  });
  await new Promise((r2) => setTimeout(r2, 200));
  t('Demande légitime à trois liens : reçue', r.status === 200 && recus.length === avant + 1,
    `${recus.length - avant} reçue(s)`);
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

/* ================= 3 bis. Monochrome ==================================
   « Interdiction stricte et non négociable : aucune couleur orange/ambre
   nulle part sur le site, à aucun titre. » Le produit est monochrome et
   ne s'autorise qu'un rouge, réservé aux alertes.

   Ce contrôle ne LIT PAS le CSS, il regarde ce qui est RÉELLEMENT
   RENDU : couleurs de texte, de fond, de bordure et d'ombre de chaque
   élément de chaque page. Un `grep` sur la source ne suffisait pas —
   c'est précisément comme ça que huit `rgba(255, 178, 36, …)` ont
   survécu à une passe de nettoyage qui cherchait « ffb224 » et
   « ambre ». Une couleur écrite autrement est une couleur quand même.
   ==================================================================== */

console.log('3 bis. Monochrome (aucune trace d’ambre)');
{
  for (const chemin of PAGES) {
    const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(BASE + chemin, { waitUntil: 'networkidle' });

    const fautifs = await page.evaluate(() => {
      /* Saturation et teinte d'un `rgb()`/`rgba()` rendu. */
      const lire = (v) => {
        const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(v);
        if (!m) return null;
        const [r, g, b] = [+m[1], +m[2], +m[3]];
        const a = m[4] === undefined ? 1 : +m[4];
        if (a < 0.02) return null;              // invisible, on ne juge pas
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        if (max - min < 12) return null;        // gris : neutre, donc conforme
        let h;
        const d = max - min;
        if (max === r) h = 60 * (((g - b) / d) % 6);
        else if (max === g) h = 60 * ((b - r) / d + 2);
        else h = 60 * ((r - g) / d + 4);
        if (h < 0) h += 360;
        return { h: Math.round(h), sat: max - min, css: v };
      };

      const trouves = [];
      for (const el of document.querySelectorAll('body *')) {
        const s = getComputedStyle(el);
        for (const prop of ['color', 'backgroundColor', 'borderTopColor',
                            'borderBottomColor', 'borderLeftColor',
                            'borderRightColor', 'outlineColor']) {
          const c = lire(s[prop]);
          if (!c) continue;
          /* Le rouge d'alerte du produit (#ff4230 ≈ 8°) est la SEULE
             couleur admise, et seulement en teinte franchement rouge. */
          const rougeReserve = c.h <= 12 || c.h >= 350;
          if (!rougeReserve) {
            trouves.push(`${el.tagName.toLowerCase()}.${el.className || '—'} ${prop}=${c.css} (teinte ${c.h}°)`);
          }
        }
        if (trouves.length > 4) break;
      }
      return trouves;
    });

    t(`${chemin} — aucune couleur non monochrome rendue`,
      fautifs.length === 0, fautifs.slice(0, 3).join(' · '));
    await page.close();
  }
}

/* ================= 3 ter. La capture du produit ======================
   Le fond de bandeau — six nappes en v6, une carte du monde en pointillés
   en v7 — a été retiré, et le bandeau de chiffres ronds avec lui. Les
   deux étaient du décor abstrait à la place d'une image réelle, ce que
   les inventaires de « sites fabriqués par une IA » citent en premier :
   faute de produit à photographier, la machine dessine des formes.

   Une vraie capture de l'application les remplace. Ces contrôles
   vérifient qu'elle est SERVIE, qu'elle a une alternative textuelle, et
   surtout qu'elle réserve sa place avant d'arriver — une image sans
   dimensions déclarées ferait sauter toute la page à son chargement, et
   c'est exactement ce que mesure le décalage cumulé.
   ==================================================================== */

console.log('3 ter. La capture du produit');
{
  const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 } });
  const codes = [];
  page.on('response', (r) => { if (/produit-registre/.test(r.url())) codes.push(r.status()); });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  const c = await page.evaluate(() => {
    const img = document.querySelector('.capture img');
    if (!img) return null;
    const r = img.getBoundingClientRect();
    return {
      alt: (img.getAttribute('alt') || '').trim().length,
      largeurDeclaree: img.getAttribute('width'),
      hauteurDeclaree: img.getAttribute('height'),
      ratioCss: getComputedStyle(img).aspectRatio,
      chargee: img.complete && img.naturalWidth > 0,
      naturelle: img.naturalWidth,
      affichee: Math.round(r.width),
      legende: (document.querySelector('.capture figcaption')?.textContent || '').trim().length,
    };
  });
  t('La capture est dans la page', c !== null);
  t('La capture est réellement servie', codes.length > 0 && codes.every((s) => s === 200), codes.join(', '));
  t('La capture est chargée', !!c?.chargee, `naturelle ${c?.naturelle}px`);
  t('La capture a une alternative textuelle utile', (c?.alt || 0) > 40, `${c?.alt} caractères`);
  t('La capture a une légende', (c?.legende || 0) > 20, `${c?.legende} caractères`);
  t('La capture déclare ses dimensions', !!c?.largeurDeclaree && !!c?.hauteurDeclaree,
    `${c?.largeurDeclaree}x${c?.hauteurDeclaree}`);
  t('La capture réserve sa place (aspect-ratio)', /1120\s*\/\s*512/.test(c?.ratioCss || ''), c?.ratioCss);
  /* Servir 1120 px pour en afficher 400 serait du poids gaspillé ; en
     servir 600 pour en afficher 1100 serait flou. On vérifie que la
     source est au moins aussi large que l'affichage, sans excès. */
  t('La capture est servie à une taille raisonnable',
    (c?.naturelle || 0) >= (c?.affichee || 0) && (c?.naturelle || 0) <= (c?.affichee || 0) * 2.4,
    `${c?.naturelle}px servis pour ${c?.affichee}px affichés`);

  /* Sur téléphone la capture défile horizontalement. Un conteneur qui
     défile et qu'on ne peut pas atteindre au clavier est un mur pour
     qui n'utilise pas l'écran tactile — et c'est invisible dans un
     rapport Lighthouse, qui donne 100 sur cette page. */
  {
    const ctxTel = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
    const tel = await ctxTel.newPage();
    await tel.goto(BASE + '/', { waitUntil: 'networkidle' });
    const cadre = await tel.evaluate(() => {
      const el = document.querySelector('.capture-cadre');
      if (!el) return null;
      return {
        defile: el.scrollWidth > el.clientWidth + 1,
        tabindex: el.getAttribute('tabindex'),
        role: el.getAttribute('role'),
        label: (el.getAttribute('aria-label') || '').length,
      };
    });
    t('Téléphone : la capture défile bien horizontalement', !!cadre && cadre.defile);
    t('Téléphone : le cadre défilable est atteignable au clavier',
      cadre && cadre.tabindex === '0', `tabindex=${cadre && cadre.tabindex}`);
    t('Téléphone : le cadre défilable est annoncé',
      !!cadre && !!cadre.role && cadre.label > 10, `role=${cadre && cadre.role}`);
    await tel.keyboard.press('Tab');
    const atteint = await tel.evaluate(() => {
      for (let i = 0; i < 40; i++) {
        if (document.activeElement && document.activeElement.classList.contains('capture-cadre')) return true;
        const suiv = document.activeElement;
        if (!suiv) break;
        suiv.blur();
      }
      return document.querySelector('.capture-cadre').matches(':enabled, [tabindex]');
    });
    t('Téléphone : le cadre accepte le focus', atteint);
    await ctxTel.close();
  }

  /* Le fond décoratif ne doit pas revenir par une passe d'« amélioration ». */
  const restes = await page.evaluate(() =>
    ['.carte', '.veille', '.fond', '.stats', '.seq'].filter((s) => document.querySelector(s)));
  t('Le décor abstrait et la séquence ne sont pas revenus', restes.length === 0, restes.join(' '));
  await page.close();
}

/* Rien ne doit plus être écrit sur l'appareil du visiteur : la
   confidentialité l'affirme maintenant sans réserve. */
{
  const ctx = await navigateur.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const stock = await page.evaluate(() => ({
    session: Object.keys(sessionStorage), local: Object.keys(localStorage), cookie: document.cookie,
  }));
  t('Aucune écriture en stockage de session', stock.session.length === 0, stock.session.join(', '));
  t('Aucune écriture en stockage local', stock.local.length === 0, stock.local.join(', '));
  t('Aucun cookie', stock.cookie === '', stock.cookie);
  await ctx.close();
}


/* ================= 3 quinquies. Mouvement réduit et paquet d'aperçu ===
   Deux angles qu'aucun contrôle ne regardait.

   Le premier : le dépôt n'ouvrait jamais le navigateur en mode
   « moins de mouvement ». La réinitialisation annulait les DURÉES et
   pas les RETARDS ; les six plaques du sommaire, animées avec
   `backwards`, restaient donc invisibles pendant leur retard puis
   surgissaient l'une après l'autre sur 340 ms. Un clignotement en
   cascade est précisément ce que le réglage sert à éviter.

   Le second : le fichier d'aperçu — le seul moyen actuel de montrer le
   site sur un téléphone — n'était pas un document HTML valide. Sans
   doctype il s'ouvrait en mode « quirks », avec une fenêtre virtuelle
   de 980 px sur un écran de 390, c'est-à-dire la mise en page de
   bureau réduite de moitié. Sans <meta charset>, chaque accent
   devenait « activitÃ© » dès que le fichier était servi sans en-tête.
   ==================================================================== */

console.log('3 quinquies. Mouvement réduit et paquet d’aperçu');
{
  const ctx = await navigateur.newContext({
    viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce'
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.locator('.console > summary').click();
  await page.waitForTimeout(60);
  const op = await page.evaluate(() =>
    [...document.querySelectorAll('.plaque')].map((p) => +getComputedStyle(p).opacity));
  t('Mouvement réduit : les plaques sont visibles tout de suite, sans cascade',
    op.length > 0 && op.every((o) => o > 0.99), op.join(' '));

  /* Le retard doit être neutralisé, pas seulement la durée. */
  const regles = await page.evaluate(() => {
    const el = document.querySelector('.plaque');
    const c = getComputedStyle(el);
    return { delai: c.animationDelay, duree: c.animationDuration };
  });
  t('Mouvement réduit : le retard d’animation est neutralisé',
    parseFloat(regles.delai) <= 0, `délai ${regles.delai}, durée ${regles.duree}`);
  await ctx.close();
}

{
  const { execFileSync } = await import('node:child_process');
  const { tmpdir } = await import('node:os');
  const fichier = join(tmpdir(), `amn-apercu-controle-${process.pid}.html`);
  execFileSync('node', [join(RACINE, 'scripts', 'paquet-apercu.mjs'), fichier], { stdio: 'ignore' });

  const ctx = await navigateur.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true
  });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e).slice(0, 120)));
  await page.goto('file://' + fichier, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const p = await page.evaluate(() => ({
    mode: document.compatMode,
    viewport: !!document.querySelector('meta[name="viewport"]'),
    charset: document.characterSet,
    largeur: window.innerWidth,
    accents: document.querySelector('h1').textContent.includes('activité'),
    pages: document.querySelectorAll('a[href^="/"]').length,
    externes: performance.getEntriesByType('resource')
      .filter((r) => !r.name.startsWith('file:') && !r.name.startsWith('data:')).length,
  }));
  t('Paquet : document en mode standard', p.mode === 'CSS1Compat', p.mode);
  t('Paquet : meta viewport présente', p.viewport);
  t('Paquet : encodage UTF-8 et accents intacts', p.charset === 'UTF-8' && p.accents,
    `${p.charset}, accents ${p.accents}`);
  t('Paquet : largeur réelle du téléphone, pas 980 px', p.largeur === 390, `${p.largeur} px`);
  t('Paquet : aucune requête vers l’extérieur', p.externes === 0, `${p.externes} requête(s)`);
  t('Paquet : aucune erreur au chargement', erreurs.length === 0, erreurs.join(' | '));

  /* Il doit aussi NAVIGUER : c'est tout l'intérêt du fichier. */
  await page.locator('.ftr a[href="/prix"]').click();
  await page.waitForTimeout(600);
  const apres = await page.evaluate(() => ({
    titre: document.title, tarifs: document.querySelectorAll('.tarif').length
  }));
  t('Paquet : la navigation entre pages fonctionne',
    /Prix/.test(apres.titre) && apres.tarifs === 4, JSON.stringify(apres));
  await ctx.close();
  const { unlinkSync } = await import('node:fs');
  try { unlinkSync(fichier); } catch { /* peu importe */ }
}

/* ================= 3 quater. L'assistant, question par question =======
   Un visiteur a demandé « j'ai une équipe de 24 personnes, quel
   abonnement ? ». L'assistant a refusé d'inventer — bon réflexe — mais
   la grille tarifaire elle-même ne répondait pas. En cherchant les
   questions VOISINES, trois autres trous sont apparus : « je suis tout
   seul » (effectif écrit en toutes lettres), « je suis une agence »
   (le forfait agence n'avait aucune réponse à lui) et « je vends en
   ligne » (l'option commerce non plus).

   Ce contrôle POSE les questions dans le navigateur et lit la réponse
   rendue. Les sujets non tranchés (engagement, résiliation, essai,
   remboursement) doivent AU CONTRAIRE tomber sur le renvoi au
   formulaire : le silence y est délibéré, et un contrôle qui l'oublie
   ouvrirait la porte à une promesse que personne n'a validée.
   ==================================================================== */

console.log('3 quater. L’assistant simulé, question par question');
{
  const ATTENDUES = [
    ["j'ai une équipe de 24 personnes, quel abonnement ?", 'reponse'],
    ['on est 8 dans la boîte, ça fait combien ?', 'reponse'],
    ['nous sommes 12 salariés', 'reponse'],
    ['je suis tout seul', 'reponse'],
    ['on est trois', 'reponse'],
    ['je suis une agence', 'reponse'],
    ['je vends en ligne', 'reponse'],
    ['combien ça coûte', 'reponse'],
    ['vous surveillez quoi exactement', 'reponse'],
    ['vous gardez mes données ?', 'reponse'],
    ['est-ce que vous êtes une IA ?', 'reponse'],
    ['je suis une association', 'reponse'],
    /* Non tranchés : le renvoi au formulaire est la BONNE réponse. */
    ["il y a une période d'essai gratuite ?", 'defaut'],
    ['quel est le préavis de résiliation', 'defaut'],
    ['vous remboursez si je ne suis pas content', 'defaut'],
    ['vous faites du référencement google ?', 'defaut'],
  ];

  const page = await navigateur.newPage({ viewport: { width: 1280, height: 950 } });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.locator('.ajm-invite').click();
  await page.waitForFunction(() => document.querySelector('.ajm')?.open === true);

  const MARQUE = /pas de réponse préparée|je ne vais pas en inventer|je n'ai pas de réponse/i;
  for (const [q, attendu] of ATTENDUES) {
    await page.fill('#ajm-q', q);
    await page.press('#ajm-q', 'Enter');
    await page.waitForTimeout(320);
    const rep = await page.evaluate(() => {
      const b = [...document.querySelectorAll('.ajm-bulle--lui')];
      return b.length ? b[b.length - 1].textContent.trim() : '';
    });
    const obtenu = MARQUE.test(rep) ? 'defaut' : 'reponse';
    t(`Assistant — « ${q} » → ${attendu}`, obtenu === attendu, `obtenu : ${obtenu}`);
  }

  /* Aucune réponse préparée ne doit annoncer un montant qui ne figure
     pas sur la page prix. C'est la garde contre l'invention de prix. */
  const montants = await page.evaluate(() =>
    [...document.querySelectorAll('.ajm-bulle--lui')]
      .flatMap((b) => (b.textContent.match(/\d+(?:[.,]\d+)?\s*€/g) || []))
      .map((m) => m.replace(/\s+/g, ' ').trim())
  );
  const AUTORISES = ['35 €', '109 €', '249 €', '25 €'];
  const inconnus = [...new Set(montants)].filter((m) => !AUTORISES.includes(m));
  t('Assistant — aucun montant hors grille publiée', inconnus.length === 0, inconnus.join(', '));

  await page.close();
}

/* ================= 4. En-têtes de sécurité ================= */

console.log('4. En-têtes de sécurité réellement servis');

/* Le verrou de la préversion, vérifié pour de bon.

   Il ne l'était pas : le serveur local n'appliquait qu'UN bloc
   d'en-têtes de vercel.json (`.find()` au lieu de `.filter()`), et
   `X-Robots-Tag` vit dans un second bloc sur la même source. Il n'était
   donc jamais servi ici — c'est-à-dire que le seul verrou lu quand
   robots.txt interdit l'exploration n'avait jamais été mesuré. Tout
   serait passé au vert en local avec un site indexable en production. */
{
  const modeApercu = readFileSync(join(RACINE, 'robots.txt'), 'utf8').includes('Disallow: /\n');
  const r = await fetch(BASE + '/');
  const robots = r.headers.get('x-robots-tag') || '';
  const meta = (await r.text()).includes('content="noindex,nofollow"');
  t("Le mode d'indexation est cohérent entre robots.txt, l'en-tête et la balise",
    modeApercu ? /noindex/.test(robots) && meta : !robots && !meta,
    `robots.txt ${modeApercu ? 'fermé' : 'ouvert'}, en-tête « ${robots || 'absent'} », balise ${meta}`);

  const police = await fetch(BASE + '/assets/fonts/spectral-600-latin.woff2');
  t('Les polices sont servies avec un cache long',
    /max-age=\d{6,}/.test(police.headers.get('cache-control') || ''),
    police.headers.get('cache-control') || 'aucun');
}

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

/* Le README annonce un nombre de contrôles. Il annonçait 462 pendant
   que la suite en comptait 486, et se contredisait lui-même d'une
   section à l'autre. Un document qui donne un chiffre faux sur le
   travail fait décrédibilise les chiffres justes qui l'entourent. */
{
  const readme = readFileSync(join(RACINE, 'README.md'), 'utf8');
  const annonces = [...readme.matchAll(/(\d{3})\s+contrôles/g)].map((m) => Number(m[1]));
  /* +1 : ce contrôle-ci n'est pas encore compté quand il s'exécute. */
  const attendu = ok + echecs.length + 1;
  const faux = annonces.filter((n) => n !== attendu);
  t('Le README annonce le bon nombre de contrôles', faux.length === 0,
    `suite : ${attendu} · README : ${annonces.join(', ') || 'aucun chiffre'}`);
}

console.log(`\n${'─'.repeat(58)}`);
if (echecs.length === 0) {
  console.log(`✓ ${ok} contrôles passés, aucun échec.`);
  process.exit(0);
}
console.log(`✗ ${echecs.length} ÉCHEC(S) sur ${ok + echecs.length} contrôles :\n`);
for (const e of echecs) console.log(`  • ${e}`);
process.exit(1);
