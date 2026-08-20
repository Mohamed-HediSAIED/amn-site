#!/usr/bin/env node
/* ------------------------------------------------------------------
   LA PROSE, MESURÉE.

   Mohamed, en ouvrant le site : « ÉNORMÉMENT de texte que personne ne va
   lire » et « flagrance ÉNORME que le site a été fait à l'IA ».

   Aaron avait dit la même chose en v3. Le défaut n'a jamais été corrigé
   parce qu'il n'a jamais été MESURÉ : le dépôt compte les images
   sautées, les octets, les contrastes et les teintes, mais personne n'a
   jamais compté les tournures. Un tic d'écriture qu'aucun contrôle ne
   regarde revient à chaque chantier, et c'est exactement ce qui s'est
   passé — j'en ai ajouté à chaque passage.

   Ce script compte deux choses :

     1. LA LONGUEUR. Un artisan lit sur son téléphone entre deux
        chantiers. Au-delà d'un plafond par page, le texte n'est plus lu,
        il est abandonné.

     2. LES TOURNURES QUI TRAHISSENT LA MACHINE. La principale est
        l'antithèse « X, pas Y » : elle crée du relief la première fois
        et devient un tic mécanique à la vingtième. Le site en comptait
        21.

   Les plafonds sont des CHOIX, discutables et écrits ici pour être
   discutés. Ils ne sortent d'aucune norme.

     node scripts/verifier-prose.mjs
   ------------------------------------------------------------------ */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Le plafond porte sur le CONTENU (<main>), pas sur la page entière.
   L'en-tête, le sommaire dépliable, le rail et le pied de page pèsent
   environ 300 mots identiques d'une page à l'autre : ce sont des
   repères de navigation, on les balaye, on ne les lit pas. Les compter
   dans le plafond rendrait celui-ci illisible, et surtout il ne
   récompenserait pas le seul geste qui compte, couper dans le discours.
   Le total complet reste affiché à titre indicatif.

   Les pages légales n'ont pas de plafond : leur longueur est imposée
   par ce qu'elles doivent dire, et couper y serait une faute. */
const PLAFOND = {
  'index.html': 400,
  'service.html': 500,
  'methode.html': 450,
  'prix.html': 550,
  'a-propos.html': 450,
  'contact.html': 300,
  '404.html': 120,
};
const SANS_PLAFOND = new Set(['mentions-legales.html', 'confidentialite.html']);

/* Les tournures se comptent sur le même corpus que la longueur, le
   contenu de <main>. Compter la page entière faisait apparaître neuf
   fois le tiret du <title> et neuf fois celui du sommaire : une seule
   chaîne, recopiée sur neuf pages, pesait dix-huit dans le total et
   noyait les vrais. Le seuil dit combien on tolère sur TOUT le site. */
const TICS = [
  { nom: 'antithèse « X, pas Y »', seuil: 3,
    re: /,\s*(?:pas|jamais|non)\s+[a-zà-ÿ]/g,
    note: 'le tic principal ; en garder une ou deux, jamais vingt' },
  { nom: 'tiret cadratin —', seuil: 8, re: /—/g,
    note: 'ponctuation de rédacteur, rare sous un vrai clavier' },
  { nom: "clivée « ce qui… c'est »", seuil: 2,
    re: /[Cc]e (?:qui|qu'on|que)\b[^.]{0,60}?,\s*c'est/g,
    note: 'tournure de dissertation' },
  { nom: "« ce n'est pas … c'est »", seuil: 0,
    re: /[Cc]e n'est pas[^.]{0,80}c'est/g,
    note: "la forme la plus reconnaissable ; zéro toléré" },
];

const corps = (src) => {
  const m = src.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  return m ? m[1] : src;
};

const texte = (src) => src
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ').trim();

const pages = readdirSync(RACINE).filter((f) => f.endsWith('.html')).sort();
const erreurs = [];
let total = 0;
const corpus = [];

console.log('\nLONGUEUR — mots dans <main>\n');
for (const f of pages) {
  const src = readFileSync(join(RACINE, f), 'utf8');
  const t = texte(corps(src));
  corpus.push(t);
  const mots = t.split(' ').filter(Boolean).length;
  const page = texte(src).split(' ').filter(Boolean).length;
  total += page;
  if (SANS_PLAFOND.has(f)) {
    console.log(`  ${f.padEnd(24)} ${String(mots).padStart(5)} mots   (légal, sans plafond)`);
    continue;
  }
  const max = PLAFOND[f];
  const ok = max === undefined || mots <= max;
  console.log(`  ${f.padEnd(24)} ${String(mots).padStart(5)} mots   ${max ? `plafond ${max}` : ''} ${ok ? '' : '  ✗'}   (page entière : ${page})`);
  if (!ok) erreurs.push(`${f} : ${mots} mots dans <main> pour un plafond de ${max}.`);
}
console.log(`\n  ${'TOTAL'.padEnd(24)} ${String(total).padStart(5)} mots  (~${Math.round(total / 200)} min de lecture)`);

/* Les réponses de l'assistant sont de la prose que le visiteur lit
   vraiment, mais elles vivent dans site.js et échappaient donc au
   comptage. Elles portaient exactement les mêmes tics que les pages. */
const bank = readFileSync(join(RACINE, 'site.js'), 'utf8');
const reponses = [...bank.matchAll(/rep:\s*'((?:[^'\\]|\\.)*)'/g)]
  .map((m) => m[1].replace(/\\'/g, "'").replace(/<[^>]+>/g, ' '));
const motsAssistant = reponses.join(' ').split(/\s+/).filter(Boolean).length;
console.log(`\n  ${'assistant (site.js)'.padEnd(24)} ${String(motsAssistant).padStart(5)} mots   ${reponses.length} réponses préparées`);

console.log('\nTOURNURES\n');
const tout = [...corpus, ...reponses].join(' ');
for (const t of TICS) {
  const n = (tout.match(t.re) || []).length;
  const ok = n <= t.seuil;
  console.log(`  ${t.nom.padEnd(30)} ${String(n).padStart(3)}   seuil ${t.seuil} ${ok ? '' : '  ✗'}`);
  if (!ok) erreurs.push(`« ${t.nom} » : ${n} occurrences pour un seuil de ${t.seuil} — ${t.note}.`);
}

console.log(`\n${'─'.repeat(62)}`);
if (erreurs.length) {
  console.log(`✗ ${erreurs.length} DÉPASSEMENT(S)\n`);
  for (const e of erreurs) console.log(`  • ${e}`);
  console.log('');
  process.exit(1);
}
console.log('✓ Longueur et tournures dans les clous.\n');
