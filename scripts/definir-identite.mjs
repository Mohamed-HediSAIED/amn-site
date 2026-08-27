#!/usr/bin/env node
/* ------------------------------------------------------------------
   Pose l'identité légale de l'éditeur dans les pages, en une commande.

     node scripts/definir-identite.mjs            # dit ce qui manque
     node scripts/definir-identite.mjs --ecrire   # écrit dans les pages

   Pourquoi un script plutôt qu'un chercher-remplacer à la main.

   Les mentions légales sont une obligation, et leur contenu se
   VÉRIFIE. Un SIREN porte une clé de contrôle ; un numéro de TVA
   intracommunautaire français se DÉDUIT du SIREN. Écrites à la main,
   deux valeurs incohérentes s'installent en production sans que rien
   ne les regarde — et c'est précisément le genre de détail qu'un
   prestataire qui vend de la rigueur ne peut pas se permettre.

   Le script refuse donc d'écrire ce qui ne tient pas debout, et
   adapte les lignes exigées à la forme juridique : une entreprise
   individuelle n'a pas de capital social, une société en a un.

   Les valeurs vivent dans identite.json. Ce fichier est le seul
   endroit à remplir ; les pages ne sont plus éditées à la main.
   ------------------------------------------------------------------ */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const ECRIRE = process.argv.includes('--ecrire');
const manques = [];
const erreurs = [];

const SOURCE = join(RACINE, 'identite.json');
if (!existsSync(SOURCE)) {
  console.error('identite.json introuvable à la racine du dépôt.');
  process.exit(2);
}
const id = JSON.parse(readFileSync(SOURCE, 'utf8'));
const ed = id.editeur ?? {};
const sg = id.signature ?? {};
const st = id.sousTraitants ?? {};

const vide = (v) => v === null || v === undefined || String(v).trim() === '';
const exige = (v, quoi) => { if (vide(v)) manques.push(quoi); return !vide(v); };

/* --------------------------------------------------------- formes -- */

const FORMES_SOCIETE = ['SASU', 'SAS', 'SARL', 'EURL', 'SCI', 'SA', 'SNC'];
const FORMES_INDIVIDUELLES = ['entreprise individuelle', 'micro-entreprise'];
const forme = String(ed.forme ?? '').trim();
const estSociete = FORMES_SOCIETE.includes(forme.toUpperCase());
const estIndividuelle = FORMES_INDIVIDUELLES.includes(forme.toLowerCase());

if (!vide(forme) && !estSociete && !estIndividuelle) {
  erreurs.push(
    `Forme juridique « ${forme} » non reconnue. Attendu : ` +
      `${FORMES_SOCIETE.join(', ')}, ${FORMES_INDIVIDUELLES.join(', ')}.`,
  );
}

/* ---------------------------------------------------- vérifications -- */

/**
 * Clé de contrôle du SIREN (algorithme de Luhn).
 *
 * Ce n'est pas du zèle : un chiffre inversé dans un SIREN donne un
 * numéro qui RESSEMBLE à un SIREN, s'affiche sans broncher, et
 * désigne soit personne soit quelqu'un d'autre.
 */
function sirenValide(siren) {
  if (!/^\d{9}$/.test(siren)) return false;
  let total = 0;
  for (let i = 0; i < 9; i += 1) {
    let n = Number(siren[8 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    total += n;
  }
  return total % 10 === 0;
}

/** Clé du numéro de TVA intracommunautaire français, déduite du SIREN. */
const cleTva = (siren) => String((12 + 3 * (Number(siren) % 97)) % 97).padStart(2, '0');

const siren = String(ed.siren ?? '').replace(/\s/g, '');
if (exige(siren, 'editeur.siren') && !sirenValide(siren)) {
  erreurs.push(
    `SIREN « ${siren} » invalide : la clé de contrôle ne tombe pas juste. ` +
      'Un chiffre inversé donne un numéro qui a l\'air correct et ne désigne pas votre entreprise. ' +
      'À relire sur annuaire-entreprises.data.gouv.fr.',
  );
}

const tvaBrute = String(ed.tva ?? '').replace(/\s/g, '');
const franchise = tvaBrute.toLowerCase() === 'franchise';
if (exige(tvaBrute, 'editeur.tva') && !franchise) {
  const m = /^FR([0-9A-Z]{2})(\d{9})$/i.exec(tvaBrute);
  if (!m) {
    erreurs.push(`Numéro de TVA « ${tvaBrute} » mal formé. Attendu : FR + 2 caractères de clé + les 9 chiffres du SIREN, ou « franchise ».`);
  } else if (sirenValide(siren) && m[2] !== siren) {
    erreurs.push(`Le numéro de TVA porte le SIREN ${m[2]}, alors que editeur.siren vaut ${siren}.`);
  } else if (sirenValide(siren) && m[1].toUpperCase() !== cleTva(siren)) {
    erreurs.push(`Clé du numéro de TVA incorrecte : ${m[1]} au lieu de ${cleTva(siren)} pour le SIREN ${siren}.`);
  }
}

const email = String(ed.email ?? '').trim();
if (exige(email, 'editeur.email')) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) erreurs.push(`Adresse email invalide : « ${email} ».`);
  else if (/\.(example|test|invalid|localhost)$/i.test(email)) erreurs.push(`Adresse email de gabarit : « ${email} ».`);
}

const tel = String(ed.telephone ?? '').trim();
if (exige(tel, 'editeur.telephone') && !/^(\+33[\s.]?[1-9]|0[1-9])([\s.]?\d{2}){4}$/.test(tel)) {
  erreurs.push(`Téléphone « ${tel} » non reconnu. Attendu : 03 20 00 00 00 ou +33 3 20 00 00 00.`);
}

exige(ed.raisonSociale, 'editeur.raisonSociale');
exige(forme, 'editeur.forme');
exige(ed.directeurPublication, 'editeur.directeurPublication');
for (const k of ['voie', 'codePostal', 'ville', 'pays']) exige(ed.siege?.[k], `editeur.siege.${k}`);
if (!vide(ed.siege?.codePostal) && !/^\d{5}$/.test(String(ed.siege.codePostal).trim())) {
  erreurs.push(`Code postal « ${ed.siege.codePostal} » : cinq chiffres attendus.`);
}

/* Le capital et le greffe ne sont exigés que là où ils existent. */
if (estSociete) {
  exige(ed.capitalEuros, 'editeur.capitalEuros (obligatoire pour une société)');
  if (!vide(ed.capitalEuros) && !(Number(ed.capitalEuros) > 0)) {
    erreurs.push(`Capital social « ${ed.capitalEuros} » : un montant positif est attendu.`);
  }
  exige(ed.rcsVille, 'editeur.rcsVille (ville du greffe, obligatoire pour une société)');
} else if (estIndividuelle && !vide(ed.capitalEuros)) {
  erreurs.push('Une entreprise individuelle n\'a pas de capital social : laissez editeur.capitalEuros à null.');
}

for (const [k, quoi] of [['qui', 'signature.qui'], ['role', 'signature.role'], ['ou', 'signature.ou'], ['depuis', 'signature.depuis']]) {
  exige(sg[k], quoi);
}
if (!vide(sg.depuis) && !/^\d{4}$/.test(String(sg.depuis).trim())) {
  erreurs.push(`signature.depuis « ${sg.depuis} » : une année à quatre chiffres est attendue.`);
}

const GARANTIES = {
  ccts: 'les clauses contractuelles types de la Commission européenne',
  dpf: 'son adhésion au cadre de protection des données UE–États-Unis',
  'dpf+ccts': 'son adhésion au cadre de protection des données UE–États-Unis, complétée par les clauses contractuelles types de la Commission européenne',
};
for (const nom of ['vercel', 'resend']) {
  const v = String(st[nom] ?? '').trim().toLowerCase();
  if (!exige(v, `sousTraitants.${nom}`)) continue;
  if (!GARANTIES[v]) {
    erreurs.push(`sousTraitants.${nom} : « ${v} » inconnu. Attendu : ccts, dpf, ou dpf+ccts.`);
  }
}

/* ------------------------------------------------------------ rendu -- */

const echapper = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const nbsp = (v) => echapper(v).replace(/ /g, '&nbsp;');

/* La mention « EI » précède ou suit le nom d'un entrepreneur individuel
   sur tous ses documents (art. R. 123-237 du code de commerce). */
const raison = estIndividuelle ? `${echapper(ed.raisonSociale)} — EI` : echapper(ed.raisonSociale);

const valeurs = {
  raisonSociale: raison,
  forme: echapper(forme),
  siege: [echapper(ed.siege?.voie), `${nbsp(ed.siege?.codePostal ?? '')} ${echapper(ed.siege?.ville ?? '')}`, echapper(ed.siege?.pays)]
    .filter(Boolean).join(', '),
  immatriculation: estSociete
    ? `SIREN ${nbsp(siren)}, RCS de ${echapper(ed.rcsVille)}`
    : `SIREN ${nbsp(siren)}`,
  capital: estSociete
    ? `${nbsp(new Intl.NumberFormat('fr-FR').format(Number(ed.capitalEuros)))}&nbsp;€`
    : 'Sans objet — entreprise individuelle',
  tva: franchise
    ? 'TVA non applicable, article 293 B du code général des impôts'
    : nbsp(tvaBrute.toUpperCase()),
  directeurPublication: echapper(ed.directeurPublication),
  telephone: nbsp(tel),
  email: `<a href="mailto:${echapper(email)}">${echapper(email)}</a>`,
  signatureQui: echapper(sg.qui),
  signatureRole: echapper(sg.role),
  signatureOu: echapper(sg.ou),
  signatureDepuis: echapper(sg.depuis),
  transferts:
    `Vercel Inc. encadre ce transfert par ${GARANTIES[String(st.vercel ?? '').trim().toLowerCase()] ?? ''}. ` +
    `Resend Inc. l'encadre par ${GARANTIES[String(st.resend ?? '').trim().toLowerCase()] ?? ''}. ` +
    'Ces garanties figurent dans leurs contrats de sous-traitance respectifs, ' +
    'que nous pouvons vous communiquer sur demande.',
};

const PAGES = {
  'mentions-legales.html': ['raisonSociale', 'forme', 'siege', 'immatriculation', 'capital', 'tva', 'directeurPublication', 'telephone', 'email'],
  'a-propos.html': ['signatureQui', 'signatureRole', 'signatureOu', 'signatureDepuis'],
  'confidentialite.html': ['transferts'],
};

/* --------------------------------------------------------- rapport -- */

if (manques.length > 0 || erreurs.length > 0) {
  if (erreurs.length > 0) {
    console.error(`\n${erreurs.length} valeur(s) à corriger dans identite.json :`);
    for (const e of erreurs) console.error(`  ✗ ${e}`);
  }
  if (manques.length > 0) {
    console.log(`\n${manques.length} champ(s) encore vide(s) dans identite.json :`);
    for (const m of manques) console.log(`  · ${m}`);
  }
  console.log('\nOù trouver ces informations : docs/identite.md');
  process.exit(erreurs.length > 0 ? 1 : 2);
}

if (!ECRIRE) {
  console.log('\nidentite.json est complet et cohérent.');
  console.log('Pour poser les valeurs dans les pages :  node scripts/definir-identite.mjs --ecrire');
  process.exit(0);
}

/* ---------------------------------------------------------- écrire -- */

let poses = 0;
for (const [page, champs] of Object.entries(PAGES)) {
  const chemin = join(RACINE, page);
  let src = readFileSync(chemin, 'utf8');
  for (const champ of champs) {
    /* On remplace le CONTENU de l'élément porteur de data-champ, sans
       toucher à sa balise : la structure de la page reste celle qui a
       été relue et vérifiée. */
    const motif = new RegExp(`(<(dd|p)([^>]*\\bdata-champ="${champ}"[^>]*)>)([\\s\\S]*?)(</\\2>)`);
    if (!motif.test(src)) {
      console.error(`✗ ${page} : aucun élément data-champ="${champ}".`);
      process.exit(1);
    }
    src = src.replace(motif, (_m, ouvre, _b, _attrs, _dedans, ferme) => `${ouvre}${valeurs[champ]}${ferme}`);
    poses += 1;
  }
  writeFileSync(chemin, src);
  console.log(`  ${page} — ${champs.length} champ(s)`);
}

/* Les blocs JSON-LD n'ont pas changé ici, mais le faire coûte une
   seconde et évite de découvrir une CSP périmée en production. */
execFileSync(process.execPath, [join(RACINE, 'scripts', 'csp-empreintes.mjs')], { stdio: 'inherit' });

console.log(`\n✓ ${poses} valeur(s) posées. Relancer :  node scripts/verifier-avant-mise-en-ligne.mjs`);
