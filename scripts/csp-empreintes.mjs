#!/usr/bin/env node
/* ------------------------------------------------------------------
   Synchronise les empreintes de la politique de sécurité de contenu.

   Le site n'autorise que ses propres fichiers (`script-src 'self'`).
   Les seuls scripts écrits DANS les pages sont les blocs JSON-LD, qui
   doivent donc être autorisés un par un, par empreinte SHA-256.

   Sans ça, la CSP bloque le JSON-LD en silence : les pages s'affichent
   normalement, une erreur apparaît dans la console, et le balisage que
   Google devait lire n'est jamais interprété. C'est exactement le genre
   de panne qu'on ne voit pas en regardant le site.

     node scripts/csp-empreintes.mjs          → vérifie (sort en 1 si décalé)
     node scripts/csp-empreintes.mjs --ecrire → met vercel.json à jour
   ------------------------------------------------------------------ */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const ECRIRE = process.argv.includes('--ecrire');

const pages = readdirSync(RACINE).filter((f) => f.endsWith('.html'));
const empreintes = new Set();

for (const page of pages) {
  const html = readFileSync(join(RACINE, page), 'utf8');
  for (const m of html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    const contenu = m[1];
    if (!contenu.trim()) continue;
    empreintes.add(`'sha256-${createHash('sha256').update(contenu, 'utf8').digest('base64')}'`);
  }
}

const liste = [...empreintes].sort();
const attendu = ["'self'", ...liste].join(' ');

const cheminVercel = join(RACINE, 'vercel.json');
const vercel = JSON.parse(readFileSync(cheminVercel, 'utf8'));
const entete = vercel.headers
  .find((h) => h.source === '/(.*)')
  .headers.find((h) => h.key === 'Content-Security-Policy');

const actuel = (entete.value.match(/script-src ([^;]+);/) || [])[1];

if (actuel === attendu) {
  console.log(`✓ CSP à jour — ${liste.length} bloc(s) JSON-LD autorisé(s).`);
  process.exit(0);
}

if (!ECRIRE) {
  console.error('✗ CSP DÉCALÉE. script-src déclaré :');
  console.error(`    ${actuel}`);
  console.error('  attendu d\'après les pages :');
  console.error(`    ${attendu}`);
  console.error('\n  Corriger : node scripts/csp-empreintes.mjs --ecrire');
  process.exit(1);
}

entete.value = entete.value.replace(/script-src [^;]+;/, `script-src ${attendu};`);
writeFileSync(cheminVercel, JSON.stringify(vercel, null, 2) + '\n');
console.log(`✓ vercel.json mis à jour — ${liste.length} empreinte(s) écrite(s).`);
