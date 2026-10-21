import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const WORDLIST = fileURLToPath(new URL('./data/wordlist.json', import.meta.url));

/**
 * Le pack de mots est un fichier de 1,6 Mo : il est copié dans `dist/data/` au
 * moment du build (PLAN.md §12.5, étape A3), et servi aussi en dev, pour que
 * le jeu le récupère toujours depuis la même origine que l'application.
 */
function wordlist(): Plugin {
  return {
    name: 'jdd:wordlist',
    async generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'data/wordlist.json',
        source: await readFile(WORDLIST),
      });
    },
    configureServer(server) {
      server.middlewares.use('/data/wordlist.json', async (_req, res) => {
        try {
          const body = await readFile(WORDLIST);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(body);
        } catch {
          res.statusCode = 404;
          res.end('404');
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), wordlist()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Les navigateurs mobiles cytent « Patrick Hand » depuis le cache ;
    // un nom haché par Vite le ferait retélécharger à chaque build.
    assetsInlineLimit: 0,
  },
});
