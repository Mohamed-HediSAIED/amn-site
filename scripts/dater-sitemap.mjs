#!/usr/bin/env node
/* ------------------------------------------------------------------
   Remet les <lastmod> du plan du site à la date du dernier commit de
   chaque page.

   Ils étaient figés au 11 août sur sept entrées, et absents de la
   huitième, alors que les huit pages avaient été réécrites entre-temps.
   Personne ne les mettait à jour parce qu'aucun script ne le faisait, et
   aucun contrôle ne les regardait : un plan du site qui date faux dit à
   un moteur de ne pas revenir.

   La date vient de git, pas de l'horloge : c'est la date à laquelle la
   page a VRAIMENT changé, et elle reste la même si on relance le script
   dix fois.

     node scripts/dater-sitemap.mjs
   ------------------------------------------------------------------ */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHEMIN = join(RACINE, 'sitemap.xml');

const dateDe = (fichier) => {
  try {
    const d = execFileSync('git', ['log', '-1', '--format=%cs', '--', fichier],
      { cwd: RACINE, encoding: 'utf8' }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
  } catch {
    return null;
  }
};

let xml = readFileSync(CHEMIN, 'utf8');
let n = 0;
xml = xml.replace(/<url>([\s\S]*?)<\/url>/g, (bloc) => {
  const loc = (bloc.match(/<loc>([^<]+)<\/loc>/) || [])[1] || '';
  const chemin = new URL(loc).pathname;
  const fichier = chemin === '/' ? 'index.html' : chemin.replace(/^\//, '') + '.html';
  const date = dateDe(fichier);
  if (!date) return bloc;
  n++;
  if (/<lastmod>/.test(bloc)) {
    return bloc.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${date}</lastmod>`);
  }
  /* Une entrée sans <lastmod> en reçoit un, juste après <loc>. */
  return bloc.replace(/(<loc>[^<]*<\/loc>\n)(\s*)/, `$1$2<lastmod>${date}</lastmod>\n$2`);
});
writeFileSync(CHEMIN, xml);
console.log(`\n${n} date(s) alignée(s) sur le dernier commit de chaque page.\n`);
