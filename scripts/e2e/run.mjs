#!/usr/bin/env node
/**
 * Le harnais end-to-end (PLAN.md §12.11).
 *
 *   npm run e2e -- --smoke   une page : l'app démarre, la console est propre
 *   npm run e2e              trois joueurs, une partie entière (arrive à E8)
 *
 * Il pilote un **vrai Google Chrome**, lancé par le harnais lui-même avec un
 * profil jetable. Aucun paquet supplémentaire : le Chrome DevTools Protocol
 * est dans Chrome, et Node a un WebSocket dans sa bibliothèque standard.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chrome } from './chrome.mjs';
import { waitUntil } from './cdp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

const args = process.argv.slice(2);
const headless = args.includes('--headless');

/** Un port libre, pour ne pas tomber sur le 8080 du serveur LAN. */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/** Sert `dist/` avec le serveur LAN du dépôt, sur un port libre. */
async function startServer(port) {
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

/** Le smoke test : l'app démarre-t-elle vraiment, dans un vrai Chrome ? */
async function smoke() {
  if (!existsSync(join(ROOT, 'dist/index.html'))) {
    console.log('· build absent, on le fait…');
    const build = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
    if (build.status !== 0) throw new Error('le build a échoué');
  }

  const port = await freePort();
  const server = await startServer(port);
  const chrome = await Chrome.launch({ headless });
  const url = `http://127.0.0.1:${port}/`;

  try {
    const page = await chrome.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(url);

    // L'application a rendu quelque chose.
    await page.waitFor('!!document.querySelector("#root")?.firstElementChild', {
      label: 'le rendu de l’application',
    });

    const title = await page.evaluate('document.title');
    const heading = await page.evaluate('document.querySelector("h1")?.textContent ?? ""');
    const width = await page.evaluate('window.innerWidth');

    if (title !== 'Jeu du Dictionnaire') {
      throw new Error(`titre inattendu : « ${title} »`);
    }
    if (!heading.includes('Dictionnaire')) {
      throw new Error(`titre affiché inattendu : « ${heading} »`);
    }
    if (width !== 390) {
      throw new Error(`viewport incorrect : ${width} px au lieu de 390 (balise viewport manquante ?)`);
    }

    // Le crochet de débogage expose la projection (§6.6) : c'est par là que
    // le harnais lit la phase, sans gratter le DOM (§12.11).
    await page.waitFor('!!window.__jdd', { label: 'le crochet de débogage' });
    const phase = await page.evaluate('window.__jdd.phase');
    if (!phase) throw new Error('la phase lue dans le crochet est vide');

    // L'accueil : un pseudo, et la création d'une salle.
    await page.fill('Pseudo', 'Testeur');
    await page.clickLabel('Créer une salle');
    await page.waitFor('window.__jdd && window.__jdd.isSeated === true', {
      label: 'le salon',
    });
    const seatedPhase = await page.evaluate('window.__jdd.phase');
    if (seatedPhase !== 'LOBBY') {
      throw new Error(`phase inattendue après la création : « ${seatedPhase} »`);
    }
    const code = await page.text('.room__code');
    if (!/^[A-Z]{4}$/.test(code)) {
      throw new Error(`code de salle inattendu : « ${code} »`);
    }

    // Le pack de mots est servi depuis la même origine que l'application
    // (§6.6) : sans lui, le Chooser n'a qu'à saisir les mots à la main.
    const pack = await page.evaluate(
      'fetch("/data/wordlist.json").then((r) => r.json()).then((p) => p.words.length)',
    );
    if (!pack || pack < 1000) {
      throw new Error(`pack de mots indisponible : ${pack} mots`);
    }

    if (page.consoleErrors.length > 0) {
      throw new Error(`console sale :\n  - ${page.consoleErrors.join('\n  - ')}`);
    }

    const shots = join(ROOT, 'dist', 'e2e');
    await mkdir(shots, { recursive: true });
    // On laisse le fondu d'arrivée se terminer : la capture doit montrer
    // l'écran posé, pas à mi-chemin.
    await new Promise((resolve) => setTimeout(resolve, 400));
    const file = await page.screenshot(join(shots, 'smoke.png'));

    console.log('✔ l’application démarre dans un vrai Google Chrome');
    console.log(`  · titre      : ${title}`);
    console.log(`  · viewport   : ${width} px`);
    console.log(`  · phase      : ${phase} → ${seatedPhase}`);
    console.log(`  · salle      : ${code}`);
    console.log(`  · console    : propre`);
    console.log(`  · capture    : ${file}`);
  } finally {
    await chrome.close();
    server.kill();
  }
}

try {
  if (args.includes('--smoke')) {
    await smoke();
  } else {
    console.error(
      'Le scénario à trois joueurs arrive à l’étape E8 du plan (PLAN.md §12.9).\n' +
        'En attendant, utilisez :  npm run e2e -- --smoke',
    );
    process.exit(1);
  }
} catch (error) {
  console.error(`✘ ${error.message}`);
  process.exit(1);
}
