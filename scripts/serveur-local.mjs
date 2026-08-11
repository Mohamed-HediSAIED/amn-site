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
  '.ico': 'image/x-icon'
};

function entetesCommunes() {
  const vercel = JSON.parse(readFileSync(join(RACINE, 'vercel.json'), 'utf8'));
  const bloc = vercel.headers.find((h) => h.source === '/(.*)');
  const out = {};
  for (const { key, value } of bloc.headers) {
    /* HSTS n'a pas de sens en HTTP local et ferait basculer le
       navigateur en HTTPS pour tout localhost. */
    if (key === 'Strict-Transport-Security') continue;
    out[key] = value;
  }
  return out;
}

export function demarrer({ port = 4173, racine = RACINE, silencieux = false } = {}) {
  const communes = entetesCommunes();
  const require = createRequire(pathToFileURL(join(racine, 'scripts/')).href);

  const serveur = createServer(async (req, res) => {
    for (const [k, v] of Object.entries(communes)) res.setHeader(k, v);

    const url = new URL(req.url, 'http://localhost');
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await demarrer({ port: Number(process.argv[2]) || 4173 });
}
