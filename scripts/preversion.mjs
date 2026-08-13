#!/usr/bin/env node
/* ------------------------------------------------------------------
   PRÉVERSION — l'interrupteur d'indexation.

   Le site part en ligne avant que la structure soit immatriculée : les
   mentions légales ne sont donc pas remplies. Un site professionnel
   sans mentions légales ne doit pas être indexé — ni par égard pour la
   loi, ni pour l'image d'un studio qui vend de la rigueur.

   Cet interrupteur bascule TOUT d'un coup, dans les deux sens :

     node scripts/preversion.mjs on    → le site devient non indexable
     node scripts/preversion.mjs off   → le site redevient indexable
     node scripts/preversion.mjs       → dit seulement où on en est

   Trois verrous, parce qu'un seul ne suffit pas :

     1. `<meta name="robots" content="noindex,nofollow">` sur chaque page ;
     2. `robots.txt` en `Disallow: /` ;
     3. l'en-tête `X-Robots-Tag: noindex, nofollow` dans vercel.json.

   L'en-tête est posé dans un BLOC À PART, pas dans celui des en-têtes de
   sécurité. Deux raisons : `X-Robots-Tag` n'est pas un en-tête de
   sécurité, et la séquence d'ouverture de l'accueil annonce le nombre
   d'en-têtes de sécurité déployés — un contrôle compare cette annonce à
   vercel.json et échoue si elle ment. Glisser l'en-tête dans ce bloc
   aurait donc fait dire au site une chose fausse.

   Le troisième est le seul qui compte vraiment. `robots.txt` empêche
   d'EXPLORER, pas d'INDEXER : une URL découverte ailleurs peut se
   retrouver dans un moteur avec pour seul contenu son adresse. La
   balise `meta` ne se lit que si la page est explorée — donc jamais si
   robots.txt l'interdit. Seul l'en-tête HTTP est lu à tous les coups.
   Les trois ensemble ne laissent pas de trou.

   `verifier-avant-mise-en-ligne.mjs` lit le mode et adapte sa sévérité :
   en préversion les mentions légales vides sont un rappel, en public
   c'est une ERREUR qui fait échouer le contrôle.
   ------------------------------------------------------------------ */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

const META_PUBLIC = '<meta name="robots" content="index,follow">';
const META_PREV = '<meta name="robots" content="noindex,nofollow">';
const ENTETE = { key: 'X-Robots-Tag', value: 'noindex, nofollow' };

const ROBOTS_PREV = `# PRÉVERSION — le site n'est pas encore public.
# Remis en état par : node scripts/preversion.mjs off
User-agent: *
Disallow: /
`;

/* Les pages déjà en noindex (la 404) ne sont pas touchées : elles le
   sont pour une autre raison, et le mode public ne doit pas les rendre
   indexables par mégarde. */
const pages = readdirSync(RACINE).filter((f) => f.endsWith('.html'));

const SOURCE = '/(.*)';
const estBlocPrev = (b) => b.source === SOURCE && b.headers.length === 1 && b.headers[0].key === ENTETE.key;

function lireMode() {
  const vercel = JSON.parse(readFileSync(join(RACINE, 'vercel.json'), 'utf8'));
  const entete = vercel.headers.some(estBlocPrev);
  const robots = readFileSync(join(RACINE, 'robots.txt'), 'utf8').includes('Disallow: /\n');
  const metas = pages.filter((f) => readFileSync(join(RACINE, f), 'utf8').includes(META_PREV)).length;
  return { entete, robots, metas, vercel };
}

function appliquer(actif) {
  const { vercel } = lireMode();
  let touchees = 0;

  for (const f of pages) {
    const chemin = join(RACINE, f);
    const src = readFileSync(chemin, 'utf8');
    if (!src.includes(META_PUBLIC) && !src.includes(META_PREV)) continue; // la 404
    const neuf = actif
      ? src.replace(META_PUBLIC, META_PREV)
      : src.replace(META_PREV, META_PUBLIC);
    if (neuf !== src) {
      writeFileSync(chemin, neuf);
      touchees++;
    }
  }

  /* robots.txt. En préversion la ligne `Sitemap:` DISPARAÎT : déclarer
     un plan du site tout en interdisant l'exploration et en posant
     noindex partout serait se contredire en trois lignes. Le fichier
     sitemap.xml reste sur le disque, simplement plus personne ne le
     désigne — le retour en mode public le remet en avant intact.
     Le domaine est relu depuis sitemap.xml, pour que `off` retrouve la
     bonne adresse même après un passage de definir-domaine.mjs. */
  const cheminRobots = join(RACINE, 'robots.txt');
  const actuel = readFileSync(cheminRobots, 'utf8');
  const domaine =
    (actuel.match(/^Sitemap:\s*(\S+?)\/sitemap\.xml/m) || [])[1] ||
    (readFileSync(join(RACINE, 'sitemap.xml'), 'utf8').match(/<loc>(https?:\/\/[^/<]+)/) || [])[1] ||
    '';
  writeFileSync(
    cheminRobots,
    actif
      ? ROBOTS_PREV
      : `User-agent: *\nAllow: /\nDisallow: /api/\n` +
        (domaine ? `\nSitemap: ${domaine}/sitemap.xml\n` : '')
  );

  vercel.headers = vercel.headers.filter((b) => !estBlocPrev(b));
  if (actif) vercel.headers.push({ source: SOURCE, headers: [{ ...ENTETE }] });
  writeFileSync(join(RACINE, 'vercel.json'), JSON.stringify(vercel, null, 2) + '\n');

  return touchees;
}

const arg = (process.argv[2] || '').toLowerCase();

if (arg === 'on' || arg === 'off') {
  const actif = arg === 'on';
  const n = appliquer(actif);
  console.log(
    actif
      ? `\n✓ PRÉVERSION ACTIVE.\n\n  ${n} page(s) passée(s) en noindex,nofollow` +
          '\n  robots.txt en Disallow: /' +
          '\n  en-tête X-Robots-Tag: noindex, nofollow ajouté à vercel.json\n' +
          '\n  Le site peut être déployé et montré sans risquer de se retrouver' +
          '\n  dans un moteur de recherche avec des mentions légales vides.\n' +
          '\n  Pour le rendre public le jour venu :  node scripts/preversion.mjs off\n'
      : `\n✓ MODE PUBLIC.\n\n  ${n} page(s) repassée(s) en index,follow` +
          '\n  robots.txt rouvert' +
          '\n  en-tête X-Robots-Tag retiré de vercel.json\n' +
          '\n  ⚠ Le site est maintenant indexable. Lancer :' +
          '\n     node scripts/verifier-avant-mise-en-ligne.mjs\n' +
          '\n  Il refusera de passer tant que les mentions légales sont vides.\n'
  );
} else {
  const m = lireMode();
  const complet = m.entete && m.robots && m.metas > 0;
  const aucun = !m.entete && !m.robots && m.metas === 0;
  console.log(
    complet
      ? `\nMode : PRÉVERSION — le site n'est pas indexable.` +
          `\n  ${m.metas} page(s) en noindex, robots.txt fermé, en-tête posé.` +
          `\n\n  Le rendre public :  node scripts/preversion.mjs off\n`
      : aucun
        ? `\nMode : PUBLIC — le site est indexable.` +
            `\n\n  Le protéger :  node scripts/preversion.mjs on\n`
        : `\n⚠ Mode INCOHÉRENT — les trois verrous ne disent pas la même chose :` +
            `\n    en-tête X-Robots-Tag : ${m.entete ? 'posé' : 'absent'}` +
            `\n    robots.txt          : ${m.robots ? 'fermé' : 'ouvert'}` +
            `\n    pages en noindex    : ${m.metas}` +
            `\n\n  Rétablir :  node scripts/preversion.mjs on   (ou off)\n`
  );
}
