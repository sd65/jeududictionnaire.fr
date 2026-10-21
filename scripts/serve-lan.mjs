#!/usr/bin/env node
/** Serveur statique du jeu sur le réseau local (aucune dépendance).
 *
 *  - /            -> dist/index.html  (+ les assets de dist/)
 *  - /data/...    -> data/...         (wordlist.json)
 *
 *  Le jeu n'a pas de serveur : ce script ne fait que distribuer les fichiers
 *  (HTML/JS/CSS/JSON) aux téléphones du même Wi-Fi. Toute la logique passe
 *  par Trystero/Nostr (§6.1 de PLAN.md).
 *
 *  Usage : node scripts/serve-lan.mjs [port=8080] [--dir=dist]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, resolve } from 'node:path';
import { networkInterfaces } from 'node:os';

const ROOT = resolve(process.cwd());

const args = process.argv.slice(2);
const portArg = args.find((a) => /^\d+$/.test(a));
const dirArg = args.find((a) => a.startsWith('--dir='));
const PORT = Number(portArg) || 8080;
const APP_DIR = resolve(ROOT, dirArg ? dirArg.slice('--dir='.length) : 'dist');

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

/** Empêche de sortir de la racine servie (path traversal). */
const safeJoin = (base, rel) => {
  const p = resolve(base, '.' + normalize('/' + rel));
  return p.startsWith(base) ? p : null;
};

const resolvePath = (urlPath) => {
  const p = normalize(decodeURIComponent(urlPath.split('?')[0]));
  if (p === '/' || p === '') return join(APP_DIR, 'index.html');
  if (p.startsWith('/data/')) return safeJoin(join(ROOT, 'data'), p.slice(6));
  return safeJoin(APP_DIR, p);
};

const lanAddresses = () => {
  const out = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) out.push({ name, address: a.address });
    }
  }
  return out;
};

createServer(async (req, res) => {
  const file = resolvePath(req.url);
  if (!file) {
    res.writeHead(403).end('403');
    return;
  }
  let target = file;
  try {
    const s = await stat(target);
    if (s.isDirectory()) target = join(target, 'index.html');
  } catch {
    res.writeHead(404).end('404');
    return;
  }
  try {
    const data = await readFile(target);
    res.writeHead(200, {
      'Content-Type': MIME[extname(target)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(404).end('404');
  }
}).listen(PORT, '0.0.0.0', () => {
  const lan = lanAddresses();
  console.log(`Jeu servi depuis ${APP_DIR}`);
  console.log(`  - sur ce Mac : http://localhost:${PORT}`);
  for (const { name, address } of lan) {
    console.log(`  - sur le LAN : http://${address}:${PORT}  (${name} — téléphones, même Wi-Fi)`);
  }
  if (!lan.length) {
    console.log('  - (aucune adresse LAN détectée : le Mac n’est pas connecté à un réseau ?)');
  }
  console.log(`\nCréez une salle dans l'app, puis ouvrez l'URL ci-dessus + /?room=CODE sur chaque téléphone.`);
});
