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
import { inflateSync } from 'node:zlib';
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

/* ── 3 bis. Les couleurs DANS LES IMAGES ───────────────────────────
   Le contrôle « monochrome » du navigateur lit les couleurs calculées du
   DOM. Une image lui est opaque : elle traverse la mesure sans être vue.

   C'est exactement ce qui s'est produit. assets/og.png — l'aperçu qui
   s'affiche quand on partage le lien — datait de la v1 et portait encore
   l'AMBRE #ffb224, la couleur qu'Aaron avait fait retirer de tout le
   site en v6, plus l'ancien titre de l'accueil. Huit versions sans que
   personne le voie, parce que personne ne regardait les pixels.

   Ici on décode le PNG et on échantillonne. Un gris est un pixel dont
   les trois composantes se tiennent ; au-delà, c'est une teinte. */
console.log('3 bis. Les couleurs dans les images\n');

/* Décodeur PNG minimal : 8 bits, couleur vraie, avec ou sans alpha —
   ce que produit generer-images.mjs. Assez pour compter des teintes. */
function pixels(chemin) {
  const d = readFileSync(chemin);
  let pos = 8;
  let idat = [];
  let l = 0;
  let h = 0;
  let bits = 0;
  let type = 0;
  while (pos < d.length) {
    const taille = d.readUInt32BE(pos);
    const nom = d.toString('latin1', pos + 4, pos + 8);
    if (nom === 'IHDR') {
      l = d.readUInt32BE(pos + 8);
      h = d.readUInt32BE(pos + 12);
      bits = d[pos + 16];
      type = d[pos + 17];
    } else if (nom === 'IDAT') {
      idat.push(d.subarray(pos + 8, pos + 8 + taille));
    }
    pos += 12 + taille;
  }
  const canaux = { 0: 1, 2: 3, 4: 2, 6: 4 }[type];
  if (bits !== 8 || !canaux) return null;      /* format non géré : on le dira */
  const brut = inflateSync(Buffer.concat(idat));
  const pas = l * canaux;
  const sortie = [];
  let prec = Buffer.alloc(pas);
  let i = 0;
  for (let y = 0; y < h; y++) {
    const f = brut[i++];
    const ligne = Buffer.from(brut.subarray(i, i + pas));
    i += pas;
    for (let x = 0; x < pas; x++) {
      const a = x >= canaux ? ligne[x - canaux] : 0;
      const b = prec[x];
      const c = x >= canaux ? prec[x - canaux] : 0;
      if (f === 1) ligne[x] = (ligne[x] + a) & 255;
      else if (f === 2) ligne[x] = (ligne[x] + b) & 255;
      else if (f === 3) ligne[x] = (ligne[x] + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        ligne[x] = (ligne[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    prec = ligne;
    if (canaux >= 3) {
      for (let x = 0; x < l; x++) {
        const o = x * canaux;
        if (canaux === 4 && ligne[o + 3] < 8) continue;   /* transparent */
        sortie.push([ligne[o], ligne[o + 1], ligne[o + 2]]);
      }
    }
  }
  return { largeur: l, hauteur: h, px: sortie };
}

for (const img of ['assets/og.png', 'assets/icon-512.png', 'assets/apple-touch-icon.png',
                   'assets/favicon-32.png', 'assets/produit-registre.jpg']) {
  const chemin = join(RACINE, img);
  if (!existsSync(chemin)) { t(`${img} existe`, false); continue; }
  if (img.endsWith('.jpg')) {
    /* La capture est une copie d'écran du produit : on ne lui demande
       pas d'être grise, le produit ne l'est pas partout (les gravités
       du scanner sont en rouge). On vérifie seulement son poids. */
    t(`${img} reste sous 60 Ko`, statSync(chemin).size < 60 * 1024,
      `${(statSync(chemin).size / 1024).toFixed(0)} Ko`);
    continue;
  }
  const img_ = pixels(chemin);
  const px = img_ && img_.px;
  if (!px) { t(`${img} est décodable`, false, 'format PNG non géré par le contrôle'); continue; }

  /* CE QU'ON MESURE, ET POURQUOI CE N'EST PAS « LE POURCENTAGE DE
     PIXELS COLORÉS ».

     Une image de texte rendue par un navigateur contient toujours des
     pixels colorés : le lissage sous-pixel borde chaque lettre de
     liserés bleutés et jaunâtres. Sur l'aperçu de partage propre, ils
     représentent 0,26 % de l'image. Avec l'ambre remise dans le
     soulignement du titre, on passe à 0,39 %. Aucun seuil en
     pourcentage ne sépare proprement ces deux-là — j'ai essayé.

     Ce qui les sépare, c'est la FORME DE LA DISTRIBUTION. Les liserés
     d'anticrénelage s'étalent sur des centaines de teintes voisines,
     toutes à peu près aussi rares : sur l'aperçu propre, la plus
     fréquente revient 99 fois et la suivante 94. Une couleur de charte
     est au contraire une valeur exacte posée en aplat, donc une
     VALEUR ABERRANTE : avec l'ambre, la première revenait 945 fois et
     la suivante 99.

     On compare donc la couleur saturée la plus fréquente à la
     deuxième. Un rapport proche de 1 est du lissage ; un rapport de 9
     est une décision graphique. Ce test ne dépend pas de la taille de
     l'image, ce qu'aucun seuil en pourcentage ne permettait :
     3 pixels sur une icône de 32 px valent 0,3 % et ne veulent rien
     dire. Mesuré sur les quatre images du site, ci-dessous. */
  const compte = new Map();
  let satures = 0;
  for (const [r, v, b] of px) {
    if (Math.max(r, v, b) - Math.min(r, v, b) <= 24) continue;
    satures++;
    const cle = (r << 16) | (v << 8) | b;
    compte.set(cle, (compte.get(cle) || 0) + 1);
  }
  const classees = [...compte.entries()].sort((a, b) => b[1] - a[1]);
  const [picCle, pic] = classees[0] || [0, 0];
  const second = classees[1] ? classees[1][1] : 0;
  const hex = '#' + picCle.toString(16).padStart(6, '0');
  /* En dessous de vingt pixels, aucune image n'a d'aplat : c'est du
     bruit, quelle que soit sa proportion. */
  const aplat = pic >= 20 && pic > 3 * Math.max(second, 1);
  t(`${img} ne porte aucun aplat de couleur`, !aplat,
    `dominante ${hex} ×${pic}, suivante ×${second} (rapport ${(pic / Math.max(second, 1)).toFixed(1)}) ; ` +
    `${satures} pixels saturés au total (${(100 * satures / px.length).toFixed(2)} %), ` +
    `c'est-à-dire les liserés d'anticrénelage`);
}

/* Le gabarit qui produit ces images est du CONTENU : il porte le titre
   de l'accueil. S'il diverge, l'aperçu de partage annonce autre chose
   que la page. */
{
  const gen = readFileSync(join(RACINE, 'scripts', 'generer-images.mjs'), 'utf8');
  const titreOg = (gen.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1] || '';
  const titrePage = ((lire('index.html').match(/<h1>([\s\S]*?)<\/h1>/) || [])[1] || '');
  const nu = (x) => x.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  t("Le titre de l'aperçu de partage est celui de l'accueil",
    nu(titreOg) === nu(titrePage), `og : « ${nu(titreOg)} » · page : « ${nu(titrePage)} »`);
  const genSansCom = gen.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  t("Le gabarit de l'aperçu ne contient plus d'ambre",
    !/ffb224|255,\s*178,\s*36/i.test(genSansCom));
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

  /* LES PROMESSES ABSOLUES DÉJÀ DÉMENTIES PAR LE CODE DU PRODUIT.

     Le site a affirmé pendant huit versions qu'on exportait « une copie
     complète de votre espace ». La fonction de sauvegarde du produit
     (src/lib/backup.ts) ramène neuf collections sur la vingtaine que
     déclare son type SyncedCollection : ni les factures, ni l'agenda,
     ni les notes, ni les médias, ni les rapports, ni les projets, ni le
     registre des sites. La phrase était fausse aux trois endroits où
     elle apparaissait.

     Chaque entrée ci-dessous est une tournure RETIRÉE après vérification
     dans le code. Elle est interdite tant que le produit ne la rend pas
     vraie. Si un jour il la rend vraie, on retire la ligne — et on écrit
     pourquoi. */
  const DEMENTIES = [
    { re: /copie\s+complète\s+de\s+votre\s+espace/i,
      pourquoi: "l'export du produit omet factures, agenda, notes, médias, rapports, projets" },
    { re: /exporte[rz]?\s+(?:tout|l['’]intégralité)/i,
      pourquoi: "même raison : l'export est partiel" },
    { re: /100\s*%\s*(?:de\s+)?(?:vos\s+)?données/i,
      pourquoi: 'aucune mesure ne soutient un tel chiffre' },
  ];
  const revenues = [];
  for (const f of pages) {
    const tt = texte(lire(f));
    for (const d of DEMENTIES) {
      const m = tt.match(d.re);
      if (m) revenues.push(`${f} : « ${m[0]} » — ${d.pourquoi}`);
    }
  }
  t('Aucune promesse déjà démentie par le code du produit',
    revenues.length === 0, revenues.join(' · '));

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
