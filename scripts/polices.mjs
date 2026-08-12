#!/usr/bin/env node
/* ------------------------------------------------------------------
   Régénère les polices auto-hébergées de assets/fonts/ + assets/fonts.css.

   Les polices ne sont PAS chargées depuis un service tiers : ça
   transmettrait l'adresse IP de chaque visiteur à quelqu'un d'autre, ce
   que confidentialite.html affirme ne pas faire. Elles sont donc
   téléchargées une fois, découpées, et servies depuis le site.

   Deux familles, toutes deux sous licence SIL Open Font License 1.1,
   et ce sont CELLES DU PRODUIT — amn-desktop/src/index.css :

     --font-sans: 'Space Grotesk', ...
     --font-mono: 'JetBrains Mono', ...

   La v3 les avait remplacées par Archivo + Martian Mono pour donner au
   site « plus de caractère ». C'était l'erreur : le site n'a pas à
   chercher son caractère, il porte celui du produit. Aucun axe de
   largeur ici — Space Grotesk n'en a pas — donc la hiérarchie tient sur
   la graisse et la taille.

   Prérequis (outil de développement, jamais déployé) :
     pip install fonttools brotli

     node scripts/polices.mjs
   ------------------------------------------------------------------ */
import { execFile } from 'node:child_process';
import { mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(RACINE, 'assets', 'fonts');
const TMP = join(RACINE, '.polices-tmp');

/* Les mêmes plages que celles servies par Google Fonts, pour que le
   navigateur ne télécharge `latin-ext` que s'il rencontre un caractère
   qui s'y trouve. En français courant, il ne le télécharge jamais. */
const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,' +
  'U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,' +
  'U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,' +
  'U+2C60-2C7F,U+A720-A7FF';

const SOURCES = {
  grotesk:
    'https://raw.githubusercontent.com/floriankarsten/space-grotesk/master/fonts/variable/SpaceGrotesk%5Bwght%5D.ttf',
  jetbrains:
    'https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/fonts/variable/JetBrainsMono%5Bwght%5D.ttf'
};

/* UN SEUL fichier par famille et par plage Unicode, qui GARDE son axe
   de graisse : une police variable couvre toutes les graisses employées
   sans qu'on télécharge un fichier par graisse.

   Les plages sont celles que le PRODUIT charge réellement — Space
   Grotesk 400/500/600/700, JetBrains Mono 400/500/700 — et pas une de
   plus : chaque graisse gardée en trop est du poids téléchargé pour
   rien. Les noms de fichiers reprennent ceux d'avant la v3, pour que
   les préchargements des neuf pages restent valables. */
const SORTIES = [
  {
    nom: 'space-grotesk-400700',
    source: 'grotesk',
    axes: ['wght=300:700'],
    famille: 'Space Grotesk',
    graisses: '300 700',
    largeurs: null
  },
  {
    nom: 'jetbrains-mono-400',
    source: 'jetbrains',
    axes: ['wght=400:800'],
    famille: 'JetBrains Mono',
    graisses: '400 800',
    largeurs: null
  }
];

async function telecharger(url, vers) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  await writeFile(vers, Buffer.from(await r.arrayBuffer()));
}

const py = (mod, args) => execFileP('python3', ['-m', mod, ...args], { maxBuffer: 1 << 26 });

await mkdir(TMP, { recursive: true });
await mkdir(DEST, { recursive: true });

console.log('Téléchargement des sources…');
for (const [nom, url] of Object.entries(SOURCES)) {
  await telecharger(url, join(TMP, `${nom}.ttf`));
}

let css =
  `/* Polices auto-hébergées — aucun appel à un serveur tiers (RGPD).\n` +
  `   Space Grotesk (Florian Karsten) et JetBrains Mono (JetBrains),\n` +
  `   SIL Open Font License 1.1. Ce sont les polices du produit.\n` +
  `   Sous-ensembles latin + latin-ext. GÉNÉRÉE PAR scripts/polices.mjs,\n` +
  `   ne pas éditer à la main. */\n`;

let total = 0;
for (const s of SORTIES) {
  const instance = join(TMP, `${s.nom}-inst.ttf`);
  await py('fontTools.varLib.instancer', [join(TMP, `${s.source}.ttf`), ...s.axes, '-o', instance]);

  for (const [suffixe, plage] of [
    ['latin-ext', LATIN_EXT],
    ['latin', LATIN]
  ]) {
    const fichier = `${s.nom}-${suffixe}.woff2`;
    await py('fontTools.subset', [
      instance,
      `--unicodes=${plage}`,
      '--layout-features=kern,liga,calt,tnum',
      '--flavor=woff2',
      `--output-file=${join(DEST, fichier)}`,
      '--no-hinting',
      '--desubroutinize'
    ]);
    const { size } = await stat(join(DEST, fichier));
    total += size;
    console.log(`  ${fichier.padEnd(34)} ${String(size).padStart(7)} o`);

    css +=
      `\n/* ${suffixe} */\n@font-face {\n` +
      `  font-family: '${s.famille}';\n  font-style: normal;\n` +
      `  font-weight: ${s.graisses};\n` +
      (s.largeurs ? `  font-stretch: ${s.largeurs};\n` : '') +
      `  font-display: swap;\n` +
      `  src: url('fonts/${fichier}') format('woff2');\n` +
      `  unicode-range: ${plage.replace(/,/g, ', ')};\n}\n`;
  }
}

await writeFile(join(RACINE, 'assets', 'fonts.css'), css);
await rm(TMP, { recursive: true, force: true });

/* Les anciennes polices ne doivent pas rester : elles seraient servies
   sans être utilisées, et personne ne s'en apercevrait. */
for (const vieux of [
  'space-grotesk-400700-latin.woff2',
  'space-grotesk-400700-latin-ext.woff2',
  'jetbrains-mono-400-latin.woff2',
  'jetbrains-mono-400-latin-ext.woff2'
]) {
  await rm(join(DEST, vieux), { force: true });
}

console.log(`\nTotal : ${total} o  (v2 : Space Grotesk + JetBrains Mono = 84 284 o)`);
console.log("N'oublie pas : la liste des polices est citée dans mentions-legales.html.");
await readFile(join(RACINE, 'assets', 'fonts.css'), 'utf8');
