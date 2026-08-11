#!/usr/bin/env node
/* ------------------------------------------------------------------
   Régénère les polices auto-hébergées de assets/fonts/ + assets/fonts.css.

   Les polices ne sont PAS chargées depuis un service tiers : ça
   transmettrait l'adresse IP de chaque visiteur à quelqu'un d'autre, ce
   que confidentialite.html affirme ne pas faire. Elles sont donc
   téléchargées une fois, découpées, et servies depuis le site.

   Deux familles, toutes deux sous licence SIL Open Font License 1.1 :

     Archivo (Omnibus-Type) — variable, avec un axe de LARGEUR. C'est
       cet axe qui fait tout le travail : les titres sont figés en
       élargi (wdth 118), le texte courant en normal (wdth 100). Une
       seule famille, deux présences très différentes.

     Martian Mono (Evil Martians) — le mono. Large, dessiné pour être
       lu de loin sur un écran technique. C'est lui qui porte
       l'identité : boutons, étiquettes, chiffres, console.

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
  archivo:
    'https://raw.githubusercontent.com/Omnibus-Type/Archivo/master/fonts/variable/Archivo%5Bwdth,wght%5D.ttf',
  martian:
    'https://raw.githubusercontent.com/evilmartians/mono/main/fonts/variable/MartianMono%5Bwdth,wght%5D.ttf'
};

/* UN SEUL fichier Archivo, qui GARDE son axe de largeur (100 → 118).
   La première version en livrait deux, un par largeur : 26 Ko de plus
   sur le chemin critique pour la même chose. Ici `font-stretch: 118%`
   dans site.css pioche la largeur voulue dans le même fichier.
   Les plages de graisses sont réduites à ce que site.css emploie
   réellement — le reste, ce sont des octets qu'on ferait télécharger
   pour rien. */
const SORTIES = [
  {
    nom: 'archivo',
    source: 'archivo',
    /* 400→600 et pas 400→700 : site.css n'emploie que 400 et 500, plus
       600 en réserve pour l'affichage. Chaque graisse gardée en trop
       est du poids téléchargé pour rien — la plage complète coûtait
       12 Ko de plus. */
    axes: ['wdth=100:118', 'wght=400:600'],
    famille: 'Archivo',
    graisses: '400 600',
    largeurs: '100% 118%'
  },
  {
    nom: 'martian-mono',
    source: 'martian',
    axes: ['wdth=100', 'wght=400:600'],
    famille: 'Martian Mono',
    graisses: '400 600',
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
  `   Archivo et Martian Mono, SIL Open Font License 1.1.\n` +
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
