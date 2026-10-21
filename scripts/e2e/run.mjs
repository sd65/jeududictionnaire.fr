#!/usr/bin/env node
/**
 * Le harnais end-to-end (PLAN.md §12.11).
 *
 *   npm run e2e -- --smoke   une page : l'app démarre, la console est propre
 *   npm run e2e              trois joueurs, une partie entière (T5)
 *
 * Il pilote un **vrai Google Chrome**, lancé par le harnais lui-même avec un
 * profil jetable. Aucun paquet supplémentaire : le Chrome DevTools Protocol
 * est dans Chrome, et Node a un WebSocket dans sa bibliothèque standard.
 */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Chrome } from './chrome.mjs';
import { buildIfNeeded, freePort, ROOT, startServer } from './server.mjs';
import { threePlayers } from './three-players.mjs';

const args = process.argv.slice(2);
const headless = args.includes('--headless');

/** Le smoke test : l'app démarre-t-elle vraiment, dans un vrai Chrome ? */
async function smoke() {
  buildIfNeeded();

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

    // Le menu du coin (§4.14) : il est là, il ouvre sur « Accueil » et
    // « À propos », et quitter une partie demande confirmation.
    const openMenu = async () => {
      if (!(await page.hasLabel('Accueil'))) await page.clickLabel('☰');
    };

    await openMenu();
    if (!(await page.hasLabel('Accueil'))) {
      throw new Error('le menu ne montre pas « Accueil »');
    }
    if (!(await page.hasLabel('À propos'))) {
      throw new Error('le menu ne montre pas « À propos »');
    }

    // « À propos » : la feuille passe par-dessus le jeu, et elle attribue les
    // sources avec leurs licences (§10).
    await page.clickLabel('À propos');
    await page.waitFor('!!document.querySelector(".overlay__panel")', {
      label: 'la feuille « À propos »',
    });
    const about = await page.text('.overlay__panel');
    if (!about.includes('Lexique') || !about.includes('CC BY-SA 4.0')) {
      throw new Error('« À propos » n’attribue pas les sources');
    }
    await page.clickLabel('Fermer');
    await page.waitFor('!document.querySelector(".overlay__panel")', {
      label: 'la fermeture de « À propos »',
    });

    // Quitter la partie demande confirmation.
    await openMenu();
    await page.clickLabel('Accueil');
    await page.waitFor('document.body.textContent.includes("Quitter la partie")', {
      label: 'la confirmation de sortie',
    });
    // On annule : on reste à la table.
    await page.clickLabel('Annuler');
    await page.waitFor('window.__jdd && window.__jdd.isSeated === true', {
      label: 'le retour à la table',
    });

    if (page.consoleErrors.length > 0) {
      throw new Error(`console sale :\n  - ${page.consoleErrors.join('\n  - ')}`);
    }

    const shots = join(ROOT, 'dist', 'e2e');
    await mkdir(shots, { recursive: true });
    // On laisse le fondu d'arrivée se terminer : la capture doit montrer
    // l'écran posé, pas à mi-chemin.
    await new Promise((resolve) => setTimeout(resolve, 400));
    const file = await page.screenshot(join(shots, 'smoke.png'));

    // Quitter pour de bon : l'appareil revient à l'accueil, et l'URL au
    // racine — sinon un rechargement renverrait dans la partie quittée.
    await openMenu();
    await page.clickLabel('Accueil');
    await page.clickLabel('Oui');
    await page.waitFor('!!document.querySelector(".screen--home")', {
      label: 'le retour à l’accueil',
    });
    const finalUrl = await page.evaluate('window.location.pathname + window.location.search');
    if (finalUrl !== '/') {
      throw new Error(`l’URL n’est pas revenue à la racine : « ${finalUrl} »`);
    }

    console.log('✔ l’application démarre dans un vrai Google Chrome');
    console.log(`  · titre      : ${title}`);
    console.log(`  · viewport   : ${width} px`);
    console.log(`  · phase      : ${phase} → ${seatedPhase}`);
    console.log(`  · salle      : ${code}`);
    console.log(`  · sortie     : l’accueil, URL « ${finalUrl} »`);
    console.log(`  · console    : propre`);
    console.log(`  · capture    : ${file}`);
  } finally {
    await chrome.close();
    server.kill();
  }
}

/** Le scénario à trois joueurs, sur le vrai transport (T5). */
async function three() {
  buildIfNeeded();

  const port = await freePort();
  const server = await startServer(port);
  const url = `http://127.0.0.1:${port}/`;

  try {
    console.log('· trois joueurs, trois contextes, le vrai transport…');
    const result = await threePlayers({ headless, url, shots: args.includes("--shots") });
    console.log('✔ la partie à trois joueurs se joue et se termine');
    console.log(`  · manches    : ${result.rounds}`);
    for (const row of result.ranking) {
      console.log(`  · ${row.place}. ${row.seat} — ${row.score} point(s)`);
    }
  } finally {
    server.kill();
  }
}

try {
  if (args.includes('--smoke')) {
    await smoke();
  } else {
    await three();
  }
} catch (error) {
  console.error(`✘ ${error.message}`);
  process.exit(1);
}
