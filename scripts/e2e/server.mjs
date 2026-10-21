/**
 * Le serveur de test : il sert `dist/` et le pack de mots, sur un port libre.
 *
 * Le harnais ne suppose pas qu'un serveur tourne déjà : il en monte un,
 * comme ça, et l'arrête à la fin.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitUntil } from './cdp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..', '..');

/** Un port libre, pour ne pas tomber sur le 8080 du serveur LAN. */
export function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/** Le build est-il là ? Sinon, on le fait. */
export function buildIfNeeded() {
  if (existsSync(join(ROOT, 'dist/index.html'))) return;
  console.log('· build absent, on le fait…');
  const build = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
  if (build.status !== 0) throw new Error('le build a échoué');
}

/** Sert `dist/` avec le serveur LAN du dépôt, sur un port libre. */
export async function startServer(port) {
  const child = spawn(process.execPath, [join(ROOT, 'scripts/serve-lan.mjs'), String(port)], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  await waitUntil(
    async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/`);
        return response.ok;
      } catch {
        return false;
      }
    },
    { timeout: 15000, label: 'le serveur local' },
  );
  return child;
}
