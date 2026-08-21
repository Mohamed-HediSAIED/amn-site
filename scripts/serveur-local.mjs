#!/usr/bin/env node
/* ------------------------------------------------------------------
   Serveur local — reproduit le comportement de Vercel d'assez près
   pour que ce qui est vérifié ici vaille quelque chose :

     • `cleanUrls` : /service sert service.html, /  sert index.html ;
     • les en-têtes de vercel.json sont réellement envoyés, CSP comprise
       (sans ça, une CSP cassée ne se verrait qu'en production) ;
     • /api/contact appelle la vraie fonction serverless.

     node scripts/serveur-local.mjs [port]      → http://localhost:4173
   ------------------------------------------------------------------ */
import { createServer } from 'node:http';
import { brotliCompressSync, gzipSync, constants as zlibConstants } from 'node:zlib';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Vercel compresse ce qu'il sert. Le serveur local doit le faire aussi,
   sinon toute mesure faite ici est fausse : site.css pèse 65 Ko en clair
   et 16 Ko en brotli, et Lighthouse comptait les 65. On ne mesurait pas
   le site, on mesurait l'absence de compression du serveur de test.

   Rien n'est ajouté au dépôt pour ça : zlib est dans Node. */
const COMPRESSIBLE = /^(text\/|application\/(json|xml|javascript)|image\/svg)/;

function compresser(corps, type, accept) {
  if (!COMPRESSIBLE.test(type) || corps.length < 512) return null;
  if (/\bbr\b/.test(accept)) {
    return {
      encodage: 'br',
      corps: brotliCompressSync(corps, {
        params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 }
      })
    };
  }
  if (/\bgzip\b/.test(accept)) return { encodage: 'gzip', corps: gzipSync(corps, { level: 6 }) };
  return null;
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  /* Ajoutés avec la capture du produit. Sans eux le serveur répondait
     `application/octet-stream` pour un JPEG : les 469 contrôles tournent
     contre CE serveur, ils validaient donc un type que Vercel n'enverra
     jamais. Un contrôle qui ne reproduit pas la production ne protège
     que lui-même. */
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.webmanifest': 'application/manifest+json'
};

/* Vercel applique TOUS les blocs dont la source correspond au chemin
   demandé. Ce serveur n'en appliquait qu'UN : `.find()` au lieu de
   `.filter()`, et le premier trouvé gagnait.

   Conséquence, mesurée : vercel.json déclare deux blocs sur `/(.*)`,
   celui des en-têtes de sécurité et celui de `X-Robots-Tag`. Seul le
   premier était servi. Les contrôles tournaient donc contre un serveur
   qui n'envoyait JAMAIS X-Robots-Tag — c'est-à-dire précisément le
   verrou que preversion.mjs appelle « le seul qui compte vraiment »,
   le seul lu quand robots.txt interdit l'exploration. Personne ne
   vérifiait que la préversion tenait. Les deux règles `Cache-Control`
   étaient invisibles pour la même raison.

   Les sources de vercel.json sont des motifs : on les compare comme
   tels, par requête. */
function reglesEntetes() {
  const vercel = JSON.parse(readFileSync(join(RACINE, 'vercel.json'), 'utf8'));
  return vercel.headers.map((b) => ({
    motif: new RegExp('^' + b.source + '$'),
    source: b.source,
    /* HSTS n'a pas de sens en HTTP local et ferait basculer le
       navigateur en HTTPS pour tout localhost. */
    entetes: b.headers.filter(({ key }) => key !== 'Strict-Transport-Security')
  }));
}

function entetesPour(regles, chemin) {
  const out = {};
  for (const r of regles) {
    if (!r.motif.test(chemin)) continue;
    for (const { key, value } of r.entetes) out[key] = value;
  }
  return out;
}

export function demarrer({ port = 4173, racine = RACINE, silencieux = false } = {}) {
  const regles = reglesEntetes();
  const require = createRequire(pathToFileURL(join(racine, 'scripts/')).href);

  const serveur = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    for (const [k, v] of Object.entries(entetesPour(regles, url.pathname))) {
      res.setHeader(k, v);
    }
    let chemin = decodeURIComponent(url.pathname);

    if (chemin.startsWith('/api/')) {
      const nom = chemin.slice('/api/'.length).replace(/[^a-z0-9-]/gi, '');
      const fichier = join(racine, 'api', `${nom}.js`);
      try {
        await stat(fichier);
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('404');
      }
      /* Par défaut le module est GARDÉ en cache, comme sur une instance
         Vercel encore chaude : c'est ce qui rend la limite de fréquence
         observable en local. `RECHARGER_API=1` force le rechargement à
         chaque appel, pratique quand on édite la fonction. */
      if (process.env.RECHARGER_API === '1') delete require.cache[require.resolve(fichier)];
      const handler = require(fichier);
      try {
        await handler(req, res);
      } catch (e) {
        console.error('[api]', e);
        if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Erreur serveur.' }));
      }
      return;
    }

    /* cleanUrls */
    if (chemin.endsWith('/')) chemin += 'index.html';
    let fichier = resolve(join(racine, chemin));
    if (!fichier.startsWith(resolve(racine))) {
      res.writeHead(403).end('403');
      return;
    }

    let corps = null;
    try {
      const infos = await stat(fichier);
      if (infos.isDirectory()) throw new Error('dossier');
      corps = await readFile(fichier);
    } catch {
      if (!extname(fichier)) {
        try {
          corps = await readFile(`${fichier}.html`);
          fichier = `${fichier}.html`;
        } catch {
          /* passe au 404 */
        }
      }
    }

    if (corps === null) {
      const notFound = await readFile(join(racine, '404.html')).catch(() => Buffer.from('404'));
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      return res.end(notFound);
    }

    const type = TYPES[extname(fichier)] || 'application/octet-stream';
    const comprime = compresser(corps, type, req.headers['accept-encoding'] || '');
    if (comprime) {
      res.writeHead(200, {
        'Content-Type': type,
        'Content-Encoding': comprime.encodage,
        Vary: 'Accept-Encoding'
      });
      return res.end(comprime.corps);
    }
    res.writeHead(200, { 'Content-Type': type });
    res.end(corps);
  });

  return new Promise((ok) => {
    serveur.listen(port, () => {
      if (!silencieux) console.log(`→ http://localhost:${port}`);
      ok(serveur);
    });
  });
}

/* `process.argv[1]` est absent quand le module est importé depuis un
   `node --input-type=module -e`, et `pathToFileURL(undefined)` lève.
   Le module devenait alors impossible à importer depuis un contexte
   d'évaluation — c'est-à-dire depuis un contrôle jetable. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await demarrer({ port: Number(process.argv[2]) || 4173 });
}
