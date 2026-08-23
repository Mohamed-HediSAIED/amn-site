#!/usr/bin/env node
/* ------------------------------------------------------------------
   LA CAPTURE DU PRODUIT, REFAITE DE ZÉRO.

   L'accueil du site montre une copie d'écran de l'application. La
   première version montrait le REGISTRE DES SITES — un écran qui vit
   dans `modules.internal.ts`, l'édition qu'AMN garde pour elle. Le site
   affichait donc en grand l'outil qu'il promet, deux pages plus loin,
   de ne pas livrer.

   Ce script produit la capture de l'ÉDITION CLIENTE, et il le fait sans
   toucher une ligne du produit :

     1. il lance un faux amn-api (ci-dessous) qui parle juste assez le
        dialecte du vrai — /v1/auth/me, /v1/collections/… — et sert une
        journée de démonstration ;
     2. il construit le vrai build Business (`AMN_EDITION=business`)
        avec `VITE_AMN_API_URL` pointé dessus, puis relance
        `check-business-bundle.mjs` : si un résidu de l'édition interne
        s'était glissé dans la sortie, on ne capture rien ;
     3. il ouvre le résultat dans Chromium avec l'horloge FIGÉE à 8 h 45,
        pour que les deux rendez-vous du jour soient devant et que la
        capture soit reproductible ;
     4. il écrit assets/produit-accueil.jpg et ses versions 800 et 560 px.

   Les données sont fictives et la légende de la page le dit. Ce qui est
   vrai, et c'est tout l'intérêt : l'interface, la navigation, les
   modules ouverts à une organisation cliente.

   Prérequis : le dépôt du produit à côté, ses dépendances installées
   (`npm install --ignore-scripts` suffit), et Playwright.

     node scripts/capture-produit.mjs [chemin-du-produit]
   ------------------------------------------------------------------ */

import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRODUIT = process.argv[2] || '/home/user/amn-desktop';
if (!existsSync(join(PRODUIT, 'package.json'))) {
  console.error(`Produit introuvable : ${PRODUIT}\nUsage : node scripts/capture-produit.mjs [chemin-du-produit]`);
  process.exit(1);
}
const requireProduit = createRequire(join(PRODUIT, 'package.json'));
const { WebSocketServer } = requireProduit('ws');
const PORT_API = 5311;
const PORT_WEB = 5312;

const J = (s) => new Date(Date.now() + s * 864e5).toISOString();
/* Un rendez-vous à l'heure pleine, dans N heures : « prochain rendez-vous »
   doit être devant, pas derrière, et deux créneaux ne doivent pas afficher
   la même heure. */
/* Heure MURALE de Paris (UTC+2 en août) convertie en instant absolu :
   le serveur tourne en UTC, le navigateur affiche en Europe/Paris. */
const H = (heure, minutes) => {
  const d = new Date();
  d.setUTCHours(heure - 2, minutes, 0, 0);
  return d.toISOString();
};
const ORG = { id: 'org-demo', name: 'Atelier Vasseur', plan: 'business_standard', logoDataUrl: null, modules: null };
const USER = { id: 'u-1', orgId: 'org-demo', email: 'claire@atelier-vasseur.fr', role: 'owner', status: 'active' };
const SESSION = { token: 'demo-token', expiresAt: J(30), user: USER, org: ORG };

const rec = (collection, id, data, jours = 0) =>
  ({ id, collection, data, updatedAt: J(-jours), deleted: false });

const DONNEES = {
  profiles: [rec('profiles', 'u-1', { email: USER.email, name: 'Claire Vasseur', role: 'owner' })],
  clients: [
    rec('clients', 'c1', { id: 1, name: 'Boulangerie Marest', legalName: 'SARL Marest', email: 'contact@marest.fr', phone: '03 20 55 12 04', city: 'Lille', createdAt: J(-120) }, 3),
    rec('clients', 'c2', { id: 2, name: 'Cabinet Lemoine', legalName: 'Lemoine & Associés', email: 'accueil@lemoine.fr', phone: '03 20 41 88 12', city: 'Roubaix', createdAt: J(-64) }, 9),
    rec('clients', 'c3', { id: 3, name: 'Garage Delcourt', legalName: 'Delcourt Automobiles', email: 'atelier@delcourt.fr', phone: '03 20 77 03 45', city: 'Tourcoing', createdAt: J(-30) }, 1),
  ],
  quotes: [
    rec('quotes', 'q1', { id: 1, clientId: 1, number: 'D-2026-014', title: 'Remplacement vitrine', status: 'sent', totalHt: 4820, issuedAt: J(-6) }, 6),
    rec('quotes', 'q2', { id: 2, clientId: 3, number: 'D-2026-015', title: 'Aménagement accueil', status: 'accepted', totalHt: 2390, issuedAt: J(-2) }, 2),
  ],
  invoices: [
    rec('invoices', 'f1', { id: 1, clientId: 2, number: 'F-2026-031', totalHt: 1450, status: 'sent', paymentStatus: 'pending', dueAt: J(12), issuedAt: J(-8) }, 8),
    rec('invoices', 'f2', { id: 2, clientId: 1, number: 'F-2026-030', totalHt: 980, status: 'sent', paymentStatus: 'paid', dueAt: J(-4), issuedAt: J(-22) }, 22),
  ],
  tasks: [
    rec('tasks', 't1', { title: 'Rappeler la boulangerie Marest', detail: 'Valider la teinte avant commande.', status: 'todo', priority: 'high', assigneeEmail: USER.email, createdAt: J(-1), comments: [] }, 1),
    rec('tasks', 't2', { title: 'Relancer la facture F-2026-031', detail: '', status: 'todo', priority: 'normal', assigneeEmail: USER.email, createdAt: J(-3), comments: [] }, 3),
    rec('tasks', 't3', { title: 'Commander le profilé alu', detail: '', status: 'doing', priority: 'normal', assigneeEmail: USER.email, createdAt: J(-5), comments: [] }, 5),
  ],
  appointments: [
    /* Les noms de champs sont ceux du produit — startAt, durationMin,
       clientName — sinon useAppointments retombe sur `updatedAt` et
       l'agenda affiche l'heure de la capture. */
    rec('appointments', 'r1', { title: 'Métré sur place', startAt: H(9, 30), durationMin: 60, clientId: 3, clientName: 'Garage Delcourt', location: 'Tourcoing', notes: '', reminderMin: 30, status: 'scheduled', createdAt: J(-4) }, 4),
    rec('appointments', 'r2', { title: 'Pose de la vitrine', startAt: H(14, 0), durationMin: 120, clientId: 1, clientName: 'Boulangerie Marest', location: 'Lille', notes: '', reminderMin: 60, status: 'scheduled', createdAt: J(-9) }, 9),
  ],
  projects: [
    rec('projects', 'p1', { name: 'Vitrine Marest', clientId: 1, status: 'active', dueAt: J(9) }, 2),
  ],
  notes: [rec('notes', 'n1', { title: 'Fournisseur alu', body: 'Délai passé à 3 semaines depuis janvier.', scope: 'team', updatedAt: J(-4) }, 4)],
  reports: [], media: [], objectives: [], messages: [], decisions: [],
  knowledge: [], learning: [], trackers: [], billing: [], orgDossier: [],
  projectConfig: [], remediation: [], siteMeta: [], siteNotes: [],
};

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
};

const srv = createServer((req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const envoyer = (o, code = 200) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(o));
  };
  if (p === '/v1/auth/login') return envoyer(SESSION);
  if (p === '/v1/auth/me') return envoyer({ org: ORG, user: USER });
  if (p === '/v1/auth/logout') return envoyer({ ok: true });
  const m = p.match(/^\/v1\/collections\/([^/]+)(?:\/(.+))?$/);
  if (m) {
    const col = m[1];
    if (col === '_presence') return envoyer({ members: [] });
    if (req.method === 'GET') return envoyer({ records: DONNEES[col] || [] });
    return envoyer({ record: rec(col, m[2] || 'x', {}) });
  }
  envoyer({ error: 'inconnu', chemin: p }, 404);
});

new WebSocketServer({ server: srv, path: '/v1/stream' }).on('connection', () => {});
await new Promise((ok) => srv.listen(PORT_API, ok));
console.log(`  faux amn-api  → http://localhost:${PORT_API}`);

/* ---- 2. Le vrai build Business, pointé sur le faux dos ---- */
console.log('  build Business…');
const build = spawnSync(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.renderer.config.mts'],
  { cwd: PRODUIT, stdio: 'ignore',
    env: { ...process.env, AMN_EDITION: 'business', VITE_AMN_API_URL: `http://localhost:${PORT_API}` } }
);
if (build.status !== 0) { console.error('  build en échec'); process.exit(1); }

/* Le garde-fou du produit, relancé : une sortie Business qui contient un
   résidu de l'édition interne ne doit surtout pas être photographiée. */
const garde = spawnSync(process.execPath, ['scripts/check-business-bundle.mjs'],
  { cwd: PRODUIT, encoding: 'utf8' });
if (garde.status !== 0) { console.error(garde.stdout || garde.stderr); process.exit(1); }
console.log('  bundle Business vérifié');

/* ---- 3. Servir dist/ ---- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
const web = createServer((req, res) => {
  const chemin = new URL(req.url, 'http://x').pathname;
  let f = join(PRODUIT, 'dist', chemin === '/' ? 'index.html' : chemin.replace(/^\//, ''));
  if (!existsSync(f)) f = join(PRODUIT, 'dist', 'index.html');
  const ext = f.slice(f.lastIndexOf('.'));
  res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((ok) => web.listen(PORT_WEB, ok));

/* ---- 4. La capture ---- */
/* Playwright peut venir du produit, du site, ou de l'installation
   globale : on prend le premier qui répond. */
const pw = (() => {
  const requireIci = createRequire(import.meta.url);
  for (const essai of [() => requireProduit('playwright'),
                       () => requireIci('playwright'),
                       () => requireIci('/opt/node22/lib/node_modules/playwright')]) {
    try { return essai(); } catch { /* suivant */ }
  }
  throw new Error('Playwright introuvable : npm i -D playwright');
})();
const nav = await pw.chromium.launch();
const ctx = await nav.newContext({
  viewport: { width: 1400, height: 745 }, deviceScaleFactor: 1,
  locale: 'fr-FR', timezoneId: 'Europe/Paris'
});
/* Horloge FIGÉE : sans elle, « prochain rendez-vous » dépend de l'heure
   à laquelle on lance le script, et la capture n'est pas reproductible. */
const matin = new Date(); matin.setUTCHours(6, 45, 0, 0);
await ctx.clock.setFixedTime(matin);
const page = await ctx.newPage();
await page.goto(`http://localhost:${PORT_WEB}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const champs = await page.$$('input');
await champs[0].fill(USER.email);
await champs[1].fill('demonstration');
await page.click('button[type="submit"], button:has-text("Se connecter")');
await page.waitForTimeout(2400);
const deplier = page.getByRole('button', { name: /déplier/i }).first();
if (await deplier.count()) { await deplier.click().catch(() => {}); await page.waitForTimeout(600); }

const brut = await page.screenshot();
await nav.close();

/* ---- 5. Trois tailles, en JPEG ----

   Pourquoi trois et pas deux. Un téléphone courant affiche la capture
   sur ~380 px CSS, mais son écran a 2 ou 3 pixels physiques par pixel
   CSS : le navigateur cherche donc une source d'environ 760 à 1140 px,
   et avec seulement 560 et 1120 en réserve il prend TOUJOURS la plus
   grande. La petite ne servait qu'aux écrans à densité 1, c'est-à-dire
   presque plus personne — mesuré : Lighthouse mobile téléchargeait bien
   les 36 Ko de la version 1120.

   Le palier de 800 px est celui qui couvre le cas réel. */
const nav2 = await pw.chromium.launch();
const src = 'data:image/png;base64,' + brut.toString('base64');
for (const [nom, larg] of [['produit-accueil', 1120], ['produit-accueil-800', 800], ['produit-accueil-560', 560]]) {
  const h = Math.round((larg * 745) / 1400);
  const c = await nav2.newContext({ viewport: { width: larg, height: h }, deviceScaleFactor: 1 });
  const p2 = await c.newPage();
  await p2.setContent(`<style>html,body{margin:0;background:#0a0a0a}img{width:${larg}px;display:block}</style><img src="${src}">`);
  await p2.waitForTimeout(400);
  const sortie = join(RACINE, 'assets', `${nom}.jpg`);
  await p2.screenshot({ path: sortie, type: 'jpeg', quality: 74, clip: { x: 0, y: 0, width: larg, height: h } });
  console.log(`  assets/${nom}.jpg  ${larg}×${h}  ${(statSync(sortie).size / 1024).toFixed(0)} Ko`);
  await c.close();
}
await nav2.close();
web.close(); srv.close();
console.log('\n✓ Capture refaite. Relancer : node scripts/verifier-navigateur.mjs\n');
process.exit(0);
