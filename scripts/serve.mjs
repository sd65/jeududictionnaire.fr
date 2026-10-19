#!/usr/bin/env node
/** Petit serveur statique de dev (aucune dépendance) :
 *  - /            -> web/index.html (+ assets de web/)
 *  - /data/...    -> data/...  (wordlist.json notamment)
 *  Usage : node scripts/serve.mjs [port=8765]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const ROOT = process.cwd();
const PORT = Number(process.argv[2]) || 8765;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

const resolvePath = (urlPath) => {
  const p = normalize(decodeURIComponent(urlPath.split('?')[0]));
  if (p.startsWith('/data/')) return join(ROOT, 'data', p.slice(6));
  if (p === '/' || p === '') return join(ROOT, 'web/index.html');
  return join(ROOT, 'web', p);
};

createServer(async (req, res) => {
  let file = resolvePath(req.url);
  try {
    const s = await stat(file);
    if (s.isDirectory()) file = join(file, 'index.html');
  } catch {
    res.writeHead(404).end('404');
    return;
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(404).end('404');
  }
}).listen(PORT, () => {
  console.log(`Serveur local prêt :
  - sur ce Mac  : http://localhost:${PORT}
  - sur le LAN  : http://$(ipconfig getifaddr en0):${PORT}  (téléphones, même Wi-Fi)

Ouvrez http://localhost:${PORT}/?room=demo sur plusieurs onglets pour tester.`);
});
