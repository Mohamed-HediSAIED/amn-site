#!/usr/bin/env node
/* ------------------------------------------------------------------
   LES SIGNES QUI TRAHISSENT UN SITE FABRIQUÉ PAR UNE IA.

   Mohamed, deux fois : « flagrance ÉNORME que le site a été fait à
   l'IA », puis « ça fait toujours autant IA » après une première passe
   qui n'avait touché qu'aux tournures de phrase.

   La deuxième remarque était juste. Les inventaires publiés sur le
   sujet en 2026 (925studios, Originality.ai, utsubo, Momentic, la
   compétence « avoid-ai-design ») ne parlent pas d'abord de style
   d'écriture. Ils parlent de TROIS choses, dans cet ordre :

     1. LES PREUVES ABSENTES. Pas de capture du produit, pas de photo,
        pas de nom de personne, pas d'adresse, pas de date, pas de
        client nommé. Un générateur n'a rien à photographier : il
        remplit la place avec des dégradés et des formes abstraites.
        C'est le signe le plus cité, et de loin.

     2. LA MISE EN PAGE INTERCHANGEABLE. Bandeau, trois cartes à coins
        arrondis, bandeau de chiffres ronds, accordéon de questions,
        appel à l'action répété — la même page pour n'importe quel
        métier.

     3. LES POLICES PAR DÉFAUT. Inter d'abord, et Space Grotesk juste
        derrière : celle que choisit un générateur à qui on demande
        « moderne et un peu caractériel ». Le moment où la police est
        la même que sur dix mille pages, elle ne dit plus rien du
        client, elle dit « généré ».

   Le style d'écriture vient après, et il est déjà mesuré par
   verifier-prose.mjs. Ce script-ci regarde le reste.

   Comme les autres contrôles du dépôt, il échoue plutôt qu'il
   n'avertit : un défaut qu'on se contente de signaler revient.

     node scripts/verifier-signes-ia.mjs
   ------------------------------------------------------------------ */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const pages = readdirSync(RACINE).filter((f) => f.endsWith('.html')).sort();
const css = readFileSync(join(RACINE, 'site.css'), 'utf8');
const lire = (f) => readFileSync(join(RACINE, f), 'utf8');

const echecs = [];
let n = 0;
const t = (nom, ok, detail = '') => {
  n++;
  if (!ok) echecs.push(detail ? `${nom} — ${detail}` : nom);
};

const sansCommentaires = (s) => s.replace(/<!--[\s\S]*?-->/g, ' ');
const texte = (s) =>
  sansCommentaires(s)
    .replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');

/* ── 1. Les preuves ────────────────────────────────────────────────
   L'accueil doit montrer une IMAGE RÉELLE — une capture du produit —
   et pas seulement du dessin vectoriel décoratif. Un SVG ornemental ne
   compte pas : c'est précisément ce que produit un générateur qui n'a
   rien à montrer. */
console.log('\n1. Les preuves\n');
{
  const accueil = sansCommentaires(lire('index.html'));
  const images = [...accueil.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  const captures = images.filter((b) => /\.(png|jpe?g|webp|avif)\b/i.test(b) && !/logo|favicon|icon/i.test(b));
  t("L'accueil montre au moins une image réelle du produit", captures.length >= 1,
    `${images.length} <img>, dont ${captures.length} hors logo`);

  for (const b of captures) {
    const alt = (b.match(/\balt="([^"]*)"/) || [])[1] || '';
    t('Chaque capture porte une alternative textuelle descriptive', alt.trim().length > 40,
      `alt de ${alt.trim().length} caractères`);
    t('Chaque capture déclare ses dimensions', /\bwidth="\d+"/.test(b) && /\bheight="\d+"/.test(b), b.slice(0, 70));
    const src = (b.match(/\bsrc="([^"]+)"/) || [])[1] || '';
    const chemin = join(RACINE, src.replace(/^\//, ''));
    t(`Le fichier ${src} existe`, existsSync(chemin));
    if (existsSync(chemin)) {
      const ko = statSync(chemin).size / 1024;
      t(`${src} reste sous 120 Ko`, ko < 120, `${ko.toFixed(0)} Ko`);
    }
  }
}

/* ── 2. Les polices ────────────────────────────────────────────────
   La règle ne bannit pas Space Grotesk du site : c'est la police du
   PRODUIT et elle a sa place dans le texte courant. Elle interdit
   qu'elle serve de police de TITRE, là où l'effet « page générée »
   se joue. */
console.log('2. Les polices\n');
{
  const titre = (css.match(/--f-titre:\s*([^;]+);/) || [])[1] || '';
  t('Une police de titre distincte est déclarée', titre.trim().length > 0, titre);
  const grillees = ['Inter', 'Space Grotesk', 'Geist', 'Roboto', 'Arial', 'Instrument Serif'];
  const fautive = grillees.find((f) => new RegExp(`\\b${f}\\b`, 'i').test(titre));
  t('La police de titre n\'est pas une des polices par défaut des générateurs',
    !fautive, fautive ? `${fautive} est dans la liste` : '');
  t('Les titres emploient bien cette police',
    /h1,\s*h2\s*\{[^}]*--f-titre/s.test(css), 'h1, h2 doivent prendre var(--f-titre)');
  const sansCom = (c) => c.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const feuilles = sansCom(css) + sansCom(readFileSync(join(RACINE, 'assets/fonts.css'), 'utf8'));
  t('Les polices restent servies depuis le site (aucun appel tiers)',
    !/@import|fonts\.googleapis|fonts\.gstatic/.test(feuilles));
}

/* ── 3. La mise en page ────────────────────────────────────────────
   Les éléments qui reviennent sur toutes les pages générées : bandeau
   de chiffres ronds, décor abstrait plein cadre, séquence de
   démonstration. Une fois retirés, ils ne doivent pas revenir par une
   passe d'« amélioration ». */
console.log('3. La mise en page\n');
{
  const bannis = [
    ['bandeau de chiffres décoratifs', /class="stats\b/],
    ['décor abstrait plein cadre', /class="fond\b|class="carte\b/],
    ['séquence de démonstration', /class="seq\b/],
  ];
  for (const [nom, re] of bannis) {
    const ou = pages.filter((f) => re.test(sansCommentaires(lire(f))));
    t(`Aucun ${nom}`, ou.length === 0, ou.join(', '));
  }

  /* Un dégradé coloré en bandeau est LE cliché cité en premier. Le site
     est monochrome, donc on vérifie qu'aucun dégradé ne porte de teinte. */
  const teintes = [...css.matchAll(/gradient\([^)]*\)/g)]
    .filter((m) => /#(?![0-9a-f]{0,8}\b)|hsl|rgb\(\s*\d+\s*,\s*(?!\1)/i.test(m[0]))
    .filter((m) => {
      const couleurs = [...m[0].matchAll(/#([0-9a-f]{3,8})\b/gi)].map((c) => c[1]);
      return couleurs.some((c) => {
        const h = c.length >= 6 ? c : c.replace(/(.)/g, '$1$1');
        const [r, v, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
        return Math.max(r, v, b) - Math.min(r, v, b) > 12;
      });
    });
  t('Aucun dégradé coloré', teintes.length === 0, teintes.map((m) => m[0]).slice(0, 2).join(' · '));

  /* Le même appel à l'action, mot pour mot, au bas de chaque page, est
     une marque de gabarit. Les titres doivent différer. */
  const ctas = pages
    .map((f) => [f, (sansCommentaires(lire(f)).match(/<div class="cta[^"]*"[^>]*>\s*<div>\s*<h2>([^<]+)<\/h2>/) || [])[1]])
    .filter(([, h]) => h);
  const uniques = new Set(ctas.map(([, h]) => h.trim()));
  t('Les appels à l\'action ne sont pas le même bloc recopié',
    uniques.size === ctas.length, `${ctas.length} blocs pour ${uniques.size} formulations`);
}

/* ── 4. Le remplissage ─────────────────────────────────────────────
   Les mots que personne n'écrit et que tout générateur produit. La
   liste est courte volontairement : chaque entrée doit être un mot
   qu'on ne veut voir NULLE PART, pas un mot dont on veut limiter
   l'usage. */
console.log('4. Le remplissage\n');
{
  const REMPLISSAGE = [
    /\bsolutions?\s+(?:innovante|complète|sur[- ]mesure|clés?\s+en\s+main)/i,
    /\bà\s+l['’]ère\s+d/i,
    /\bdans\s+un\s+monde\s+(?:où|de plus en plus)/i,
    /\bil\s+est\s+(?:essentiel|primordial|crucial)\s+de/i,
    /\bnotre\s+mission\s+est\s+de/i,
    /\bau\s+cœur\s+de\s+notre\s+/i,
    /\bpropulsé\s+par\s+l['’](?:IA|intelligence)/i,
    /\b(?:seamless|leverage|robuste|holistique|synergie|écosystème digital)\b/i,
    /\bexpertise\s+reconnue\b/i,
    /\bacteur\s+(?:majeur|incontournable)\b/i,
    /\bn['’]hésitez\s+pas\s+à\s+nous\s+contacter/i,
  ];
  const trouves = [];
  for (const f of pages) {
    const tt = texte(lire(f));
    for (const re of REMPLISSAGE) {
      const m = tt.match(re);
      if (m) trouves.push(`${f} : « ${m[0]} »`);
    }
  }
  t('Aucune formule de remplissage', trouves.length === 0, trouves.join(' · '));

  /* Le site qui parle de lui-même. « Ce qu'on ne fait pas », « ce qui
     n'y est pas », « ce qu'on ne promet pas » : chacune prise seule est
     honnête, mais trois sections de méta-discours sur trois pages
     donnent un site qui commente sa propre sincérité au lieu de dire
     ce qu'il vend. On en tolère UNE. */
  const meta = [];
  for (const f of pages) {
    for (const m of sansCommentaires(lire(f)).matchAll(/<h2>([^<]+)<\/h2>/g)) {
      const titre = m[1];
      const pratique = /ne\s+vous\s+demande/i.test(titre);
      if (!pratique && /\b(?:ce\s+qu['’]on\s+ne|ce\s+qui\s+n['’]y\s+est\s+pas)\b/i.test(titre)) {
        meta.push(`${f} : « ${m[1].trim()} »`);
      }
    }
  }
  t('Au plus une section de méta-discours sur tout le site', meta.length <= 1, meta.join(' · '));
}

/* ── 5. L'identité ─────────────────────────────────────────────────
   Ces points ne peuvent pas être corrigés par du code : ils demandent
   des faits. Tant que la structure n'est pas immatriculée, ce sont des
   rappels — verifier-avant-mise-en-ligne.mjs les transforme en erreurs
   quand le site passe en public. */
console.log('5. L\'identité (rappels)\n');
{
  const rappels = [];
  const legal = texte(lire('mentions-legales.html'));
  if (/à compléter/i.test(legal)) rappels.push('mentions légales : champs encore vides');
  if (readFileSync(join(RACINE, 'sitemap.xml'), 'utf8').includes('.example')) {
    rappels.push('adresse de gabarit (.example) encore en place');
  }
  const aucunNom = !pages.some((f) => /<[^>]*class="[^"]*signature/.test(lire(f)));
  if (aucunNom) rappels.push('aucune personne nommée sur le site (le signe de crédibilité le plus cité)');
  for (const r of rappels) console.log(`  ⚠ ${r}`);
  if (!rappels.length) console.log('  (rien à signaler)');
}

console.log(`\n${'─'.repeat(62)}`);
if (echecs.length) {
  console.log(`✗ ${echecs.length} ÉCHEC(S) sur ${n} contrôles :\n`);
  for (const e of echecs) console.log(`  • ${e}`);
  console.log('');
  process.exit(1);
}
console.log(`✓ ${n} contrôles passés, aucun signe.\n`);
