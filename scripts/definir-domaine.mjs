#!/usr/bin/env node
/* ------------------------------------------------------------------
   Bascule le site sur un autre nom de domaine, en une commande.

     node scripts/definir-domaine.mjs https://amn-devsec.fr

   Pourquoi ce script existe : l'adresse du site est écrite en dur à
   une trentaine d'endroits — `canonical`, `og:url`, `og:image`, le
   JSON-LD de chaque page, `robots.txt`, `sitemap.xml`. Open Graph
   EXIGE des URL absolues : un `og:image` relatif fait partir l'aperçu
   de partage sans image sur WhatsApp et Instagram, sans le moindre
   message d'erreur. Ce piège a déjà coûté cher sur deux autres sites
   de l'écosystème ; ici il se répare en une commande.

   Le script met aussi à jour les empreintes de la CSP, puisque changer
   l'adresse change le contenu des blocs JSON-LD — donc leur empreinte.
   ------------------------------------------------------------------ */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const cible = process.argv[2];

if (!cible) {
  console.error('Usage : node scripts/definir-domaine.mjs https://mon-domaine.fr');
  process.exit(2);
}

let nouvelle;
try {
  const u = new URL(cible);
  if (u.protocol !== 'https:') throw new Error('https requis');
  nouvelle = u.origin;
} catch {
  console.error(`Adresse invalide : ${cible} (attendu : https://mon-domaine.fr)`);
  process.exit(2);
}

/* L'adresse actuelle est lue dans le site lui-même : pas de valeur en
   double à tenir à jour quelque part. */
const index = readFileSync(join(RACINE, 'index.html'), 'utf8');
const actuelle = (index.match(/<link rel="canonical" href="(https?:\/\/[^/"]+)/) || [])[1];

if (!actuelle) {
  console.error("Adresse actuelle introuvable : aucune balise canonical dans index.html.");
  process.exit(1);
}
if (actuelle === nouvelle) {
  console.log(`Rien à faire, le site est déjà sur ${nouvelle}.`);
  process.exit(0);
}

const fichiers = [
  ...readdirSync(RACINE).filter((f) => f.endsWith('.html')),
  'robots.txt',
  'sitemap.xml'
];

let total = 0;
for (const nom of fichiers) {
  const chemin = join(RACINE, nom);
  const avant = readFileSync(chemin, 'utf8');
  const apres = avant.split(actuelle).join(nouvelle);
  if (avant === apres) continue;
  total += avant.split(actuelle).length - 1;
  writeFileSync(chemin, apres);
  console.log(`  ${nom}`);
}

console.log(`\n${actuelle} → ${nouvelle}  (${total} occurrence(s))`);

execFileSync(process.execPath, [join(RACINE, 'scripts', 'csp-empreintes.mjs'), '--ecrire'], {
  stdio: 'inherit'
});

console.log('\nÀ faire ensuite : redéployer, puis relancer');
console.log('  node scripts/verifier-avant-mise-en-ligne.mjs');
