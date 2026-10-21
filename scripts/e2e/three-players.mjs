/**
 * Le scénario à trois joueurs (PLAN.md §12.9, étape E8).
 *
 * Trois appareils, trois contextes Chrome isolés, **le vrai transport** :
 * les joueurs se trouvent par le relais, se parlent en pair à pair, et
 * jouent une partie entière.
 *
 * Le harnais ne gratte jamais le DOM : il lit la phase et les données dans
 * `window.__jdd` (le crochet de débogage, §6.6) et presse les boutons par
 * leurs libellés français (§12.11).
 */

import { Chrome } from './chrome.mjs';
import { Player } from './player.mjs';

const PHONE = { width: 390, height: 844 };

/** Les pseudos de la table. */
const NAMES = ['Alice', 'Bob', 'Chloé'];

/** Un tour : chaque joueur choisit une fois (§3 LOBBY). */
const TOURS = 1;

/**
 * Les points de la manche, vérifiés comme le §5 les dit.
 *
 * - une fausse qui récolte un vote : +1 à son auteur ;
 * - un joueur qui vote pour la vraie : +1 ;
 * - le Chooser : 0.
 */
function checkRound(reveal, chooser, writers, label) {
  const votes = reveal.votes ?? [];
  const totalVotes = votes.reduce((sum, count) => sum + count, 0);
  const points = reveal.roundPoints ?? {};
  const totalPoints = Object.values(points).reduce((sum, value) => sum + value, 0);

  // Chaque vote vaut exactement un point, distribué à quelqu'un.
  if (totalPoints !== totalVotes) {
    throw new Error(
      `${label} : ${totalVotes} vote(s) pour ${totalPoints} point(s) — le §5 n'est pas respecté`,
    );
  }

  // Le Chooser ne vote pas et n'écrit pas : il ne marque rien.
  if ((points[chooser.name] ?? 0) !== 0) {
    throw new Error(`${label} : le Chooser ${chooser.name} a marqué des points`);
  }

  for (const writer of writers) {
    const mine = points[writer.name] ?? 0;
    const voted = writer.votes[writer.votes.length - 1];
    if (voted === undefined) throw new Error(`${label} : ${writer.name} n’a pas voté`);

    // Ce que le joueur a *gagné* : un point s'il a voté la vraie, et un point
    // par vote reçu sur sa propre fausse (§5).
    const received = (reveal.authors ?? []).reduce((sum, author, index) => {
      return author === writer.name ? sum + (votes[index] ?? 0) : sum;
    }, 0);
    const expected = received + (voted === reveal.realIdx ? 1 : 0);

    if (mine !== expected) {
      throw new Error(
        `${label} : ${writer.name} a ${mine} point(s), au lieu de ${expected}`,
      );
    }

    if (voted !== reveal.realIdx) {
      // Il a voté une fausse : son auteur a marqué le point.
      const author = reveal.authors?.[voted];
      if (author && (points[author] ?? 0) < 1) {
        throw new Error(`${label} : la fausse de ${author} a reçu un vote, sans point`);
      }
    }
  }
}

/**
 * La partie à trois, sur le vrai transport.
 *
 * @param {{headless?: boolean, url: string, log?: (line: string) => void}} options
 */
export async function threePlayers({ headless = false, url, log = console.log, shots = false } = {}) {
  const chrome = await Chrome.launch({ headless });
  const players = [];
  const pointsByRound = [];

  try {
    /* ---------------------------------------------------------- l'hôte */
    const alicePage = await chrome.newPage({ viewport: PHONE });
    await alicePage.goto(url);
    const alice = new Player(alicePage, NAMES[0], { shots });
    players.push(alice);

    await alice.type('Pseudo', alice.name);
    await alice.press('Créer une salle');
    await alice.waitForView('v.isSeated === true', { label: "l'hôte est assis" });

    const code = await alicePage.text('.room__code');
    if (!/^[A-Z]{4}$/.test(code)) throw new Error(`code de salle inattendu : « ${code} »`);
    log(`  · salle : ${code}`);

    /* -------------------------------------------------------- les invités */
    for (const name of NAMES.slice(1)) {
      const page = await chrome.newPage({ viewport: PHONE });
      await page.goto(url);
      const player = new Player(page, name, { shots });
      players.push(player);

      await player.type('Pseudo', name);
      await player.press('Rejoindre');
      await player.type('Code de la salle', code);
      await player.press('Entrer dans la salle');
    }

    for (const player of players) {
      await player.waitForView('v.seats.length === 3', { label: 'la table est complète' });
    }
    log('  · les trois joueurs sont à table');

    /* ------------------------------------------------------------- la partie */
    await alice.type('Nombre de tours', String(TOURS));
    await alice.press('Démarrer');
    await alice.waitForPhase('PICK');

    const rounds = TOURS * NAMES.length;
    for (let round = 1; round <= rounds; round += 1) {
      // Le Chooser de la manche.
      const views = await Promise.all(players.map((player) => player.view()));
      const chooserIndex = views.findIndex((view) => view && view.isChooser);
      if (chooserIndex < 0) throw new Error(`manche ${round} : aucun Chooser`);
      const chooser = players[chooserIndex];
      const writers = players.filter((player) => player !== chooser);

      // 1. Le Chooser choisit un mot dans la pioche.
      await chooser.waitForPhase('PICK');
      await chooser.press('✓ Choisir ce mot');
      await chooser.waitForPhase('DRAFT');
      await chooser.shot(`manche-${round}-chooser-pick`);

      // 2. Chaque rédacteur envoie sa fausse définition.
      for (const writer of writers) {
        await writer.waitForPhase('DRAFT');
        await writer.type('Ta fausse définition', `Fausse de ${writer.name}`);
        await writer.press('Envoyer');
      }
      await alice.waitForView('v.submitted.length === 2', { label: 'les deux fausses sont là' });
      await alice.shot(`manche-${round}-draft`);

      // 3. L'hôte lance la dictation.
      await alice.press('Lecture');
      await alice.waitForPhase('DICTATE');
      await chooser.shot(`manche-${round}-dictate`);

      // 4. En mode vocal, on vote pendant la dictation (§4.5).
      for (const writer of writers) {
        await writer.waitForPhase('DICTATE');
        const index = await writer.voteOption();
        await writer.waitForView(`v.myVote === ${index}`, { label: 'le vote est enregistré' });
      }

      // 5. Le Chooser déclare que tout le monde a entendu.
      await chooser.press('Passer au vote — tout le monde a entendu');
      await chooser.waitForPhase('VOTE');

      // 6. L'hôte révèle.
      await alice.waitForView('v.voters === 2', { label: 'les deux votes sont là' });
      await alice.press('Révéler');
      await alice.waitForPhase('REVEAL');
      await alice.shot(`manche-${round}-reveal`);

      // 7. Les points de la manche, vérifiés comme le §5 les dit.
      const reveal = await alice.view();
      checkRound(reveal, chooser, writers, `manche ${round}`);
      pointsByRound.push(reveal.roundPoints ?? {});

      // 8. La manche suivante — ou le classement.
      await alice.press(round === rounds ? 'Voir le classement' : 'Manche suivante');
    }

    /* ------------------------------------------------------------- le contrôle */
    for (const player of players) {
      await player.waitForPhase('END');
    }

    await alice.shot('fin');
    const end = await alice.view();
    const total = end.ranking.reduce((sum, row) => sum + row.score, 0);
    const expected = NAMES.length - 1 === 0 ? 0 : rounds * (NAMES.length - 1);
    if (total !== expected) {
      throw new Error(`le classement totalise ${total} point(s), au lieu de ${expected}`);
    }

    // Les scores cumulés sont la somme des points de chaque manche.
    const summed = {};
    for (const round of pointsByRound) {
      for (const [seat, value] of Object.entries(round)) {
        summed[seat] = (summed[seat] ?? 0) + value;
      }
    }
    for (const row of end.ranking) {
      if ((summed[row.seat] ?? 0) !== row.score) {
        throw new Error(
          `${row.seat} a ${row.score} point(s) au classement, mais ${summed[row.seat] ?? 0} par les manches`,
        );
      }
    }

    // La console doit être propre, sur les trois appareils.
    for (const player of players) {
      if (player.page.consoleErrors.length > 0) {
        throw new Error(
          `console sale sur ${player.name} :\n  - ${player.page.consoleErrors.join('\n  - ')}`,
        );
      }
    }

    log('  · la partie est finie, les scores correspondent au §5');
    log(`  · classement : ${end.ranking.map((row) => `${row.seat} ${row.score}`).join(', ')}`);

    return { ranking: end.ranking, rounds };
  } finally {
    await chrome.close();
  }
}
