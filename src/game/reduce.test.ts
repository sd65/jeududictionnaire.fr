import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../ui/text';
import { reduce, type ReduceDeps } from './reduce';
import { expectedWriters, initialState, totalRounds, type Author, type State } from './state';

const PLAYERS = ['Alice', 'Bob', 'Chloé'];

/** Un mélange déterministe : l'ordre du bulletin devient prévisible. */
const keepOrder = (items: readonly Author[]) => items.slice();
const reverseOrder = (items: readonly Author[]) => items.slice().reverse();

/** Une salle au LOBBY, les joueurs assis dans l'ordre d'arrivée. */
function lobby(players: string[] = PLAYERS): State {
  let state = initialState();
  for (const name of players) state = reduce(state, { k: 'hello', name });
  return state;
}

/** La partie lancée : phase PICK, manche 1, Alice au Chooser. */
function started(players: string[] = PLAYERS): State {
  return reduce(lobby(players), { k: 'start', by: players[0]! });
}

/** La partie lancée en mode normal (textes visibles au VOTE). */
function startedNormal(players: string[] = PLAYERS): State {
  let state = lobby(players);
  state = reduce(state, { k: 'setOptions', by: players[0]!, showDefinitions: true, tours: 2 });
  return reduce(state, { k: 'start', by: players[0]! });
}

/** PICK → DRAFT : le Chooser choisit un mot. */
function drafted(state: State): State {
  return reduce(state, {
    k: 'pick',
    by: state.chooser!,
    w: 'Éléphant',
    p: 'n.m.',
    d: 'Un grand mammifère.',
  });
}

/** Chaque rédacteur envoie sa fausse définition. */
function withFakes(state: State): State {
  let out = state;
  for (const writer of expectedWriters(state)) {
    out = reduce(out, { k: 'def', by: writer, text: `Fausse de ${writer}` });
  }
  return out;
}

/** DRAFT → DICTATE : l'hôte lance la dictation, le bulletin est figé. */
function dictating(state: State, deps: ReduceDeps = { shuffle: keepOrder }): State {
  return reduce(withFakes(state), { k: 'advance', by: 'Alice' }, deps);
}

/** DICTATE → VOTE : le Chooser déclare que tout le monde a entendu. */
function voting(state: State): State {
  return reduce(state, { k: 'valid', by: state.chooser! });
}

/** Une manche complète, révélée. */
function revealed(state: State): State {
  return reduce(voting(dictating(drafted(state))), { k: 'reveal', by: 'Alice' });
}

describe('LOBBY', () => {
  it('assoit les joueurs dans l’ordre d’arrivée', () => {
    expect(lobby().seats).toEqual(PLAYERS);
  });

  it('refuse le démarrage à moins de trois joueurs', () => {
    const state = reduce(lobby(['Alice', 'Bob']), { k: 'start', by: 'Alice' });
    expect(state.phase).toBe('LOBBY');
  });

  it('refuse le démarrage quand un siège est déconnecté', () => {
    let state = lobby();
    state = reduce(state, { k: 'leave', by: 'Chloé' });
    state = reduce(state, { k: 'start', by: 'Alice' });
    expect(state.phase).toBe('LOBBY');
  });

  it('démarre avec trois joueurs connectés', () => {
    const state = started();
    expect(state.phase).toBe('PICK');
    expect(state.round).toBe(1);
    expect(state.chooser).toBe('Alice');
  });

  it('gèle le nombre de sièges au démarrage', () => {
    const state = reduce(started(), { k: 'hello', name: 'Zoé' });
    expect(state.seats).toEqual(PLAYERS);
  });

  it('ne laisse que l’hôte démarrer', () => {
    const state = reduce(lobby(), { k: 'start', by: 'Bob' });
    expect(state.phase).toBe('LOBBY');
  });

  it('calcule le nombre total de manches : tours × joueurs', () => {
    expect(totalRounds(started())).toBe(6);
  });

  it('refuse un pseudo invalide', () => {
    const state = reduce(initialState(), { k: 'hello', name: 'ab' });
    expect(state.seats).toEqual([]);
  });

  it('reprend le siège d’un joueur qui revient', () => {
    let state = lobby();
    state = reduce(state, { k: 'leave', by: 'Bob' });
    state = reduce(state, { k: 'hello', name: 'Bob' });
    expect(state.connected.Bob).toBe(true);
    expect(state.seats).toEqual(PLAYERS);
  });

  it('refuse un pseudo déjà porté par un siège connecté', () => {
    const state = reduce(lobby(), { k: 'hello', name: 'bob' });
    expect(state.seats).toEqual(PLAYERS);
  });

  it('laisse l’hôte changer les options au LOBBY seulement', () => {
    let state = reduce(lobby(), { k: 'setOptions', by: 'Alice', showDefinitions: true, tours: 3 });
    expect(state.showDefinitions).toBe(true);
    expect(state.tours).toBe(3);

    state = reduce(state, { k: 'start', by: 'Alice' });
    const after = reduce(state, { k: 'setOptions', by: 'Alice', showDefinitions: false, tours: 5 });
    expect(after.showDefinitions).toBe(true);
    expect(after.tours).toBe(3);
  });

  it('ne descend jamais sous un tour', () => {
    const state = reduce(lobby(), { k: 'setOptions', by: 'Alice', showDefinitions: false, tours: 0 });
    expect(state.tours).toBe(1);
  });

  it('ne laisse que l’hôte changer les options', () => {
    const state = reduce(lobby(), { k: 'setOptions', by: 'Bob', showDefinitions: true, tours: 5 });
    expect(state.showDefinitions).toBe(false);
    expect(state.tours).toBe(2);
  });
});

describe('PICK', () => {
  it('n’accepte que le Chooser', () => {
    const state = reduce(started(), { k: 'pick', by: 'Bob', w: 'Iguane', p: '', d: 'Un lézard.' });
    expect(state.phase).toBe('PICK');
  });

  it('enregistre le mot et passe à DRAFT', () => {
    const state = drafted(started());
    expect(state.phase).toBe('DRAFT');
    expect(state.word).toBe('Éléphant');
    expect(state.category).toBe('n.m.');
    expect(state.realDef).toBe('Un grand mammifère.');
  });

  it('refuse un mot sans définition', () => {
    const state = reduce(started(), { k: 'pick', by: 'Alice', w: 'Iguane', p: '', d: '   ' });
    expect(state.phase).toBe('PICK');
  });

  it('refuse un mot déjà joué, et le dit au siège', () => {
    const state = reduce(
      started(),
      { k: 'pick', by: 'Alice', w: 'Éléphant', p: '', d: 'Un grand mammifère.' },
      { excluded: new Set(['elephant']) },
    );
    expect(state.phase).toBe('PICK');
    expect(state.errors.Alice).toBe(MESSAGES.wordAlreadyPlayed);
  });

  it('refuse le choix pendant qu’un siège est déconnecté', () => {
    let state = started();
    state = reduce(state, { k: 'leave', by: 'Chloé' });
    state = reduce(state, { k: 'pick', by: 'Alice', w: 'Iguane', p: '', d: 'Un lézard.' });
    expect(state.phase).toBe('PICK');
  });
});

describe('DRAFT', () => {
  it('n’accepte que les rédacteurs, pas le Chooser', () => {
    const state = reduce(drafted(started()), { k: 'def', by: 'Alice', text: 'Fausse de l’hôte' });
    expect(state.fakes.Alice).toBeUndefined();
  });

  it('n’accepte que les joueurs assis', () => {
    const state = reduce(drafted(started()), { k: 'def', by: 'Zoé', text: 'Fausse' });
    expect(state.fakes.Zoé).toBeUndefined();
  });

  it('verrouille la fausse après l’envoi', () => {
    let state = reduce(drafted(started()), { k: 'def', by: 'Bob', text: 'Première' });
    state = reduce(state, { k: 'def', by: 'Bob', text: 'Seconde' });
    expect(state.fakes.Bob).toBe('Première');
  });

  it('refuse une fausse vide ou trop longue', () => {
    let state = reduce(drafted(started()), { k: 'def', by: 'Bob', text: '   ' });
    expect(state.fakes.Bob).toBeUndefined();
    state = reduce(state, { k: 'def', by: 'Bob', text: 'x'.repeat(501) });
    expect(state.fakes.Bob).toBeUndefined();
  });

  it('attend toutes les fausses avant de lancer la dictation', () => {
    let state = drafted(started());
    state = reduce(state, { k: 'def', by: 'Bob', text: 'Fausse de Bob' });
    state = reduce(state, { k: 'advance', by: 'Alice' });
    expect(state.phase).toBe('DRAFT');
  });

  it('lance la dictation une fois toutes les fausses reçues', () => {
    const state = dictating(drafted(started()));
    expect(state.phase).toBe('DICTATE');
    expect(state.ballot).toEqual(['real', 'Bob', 'Chloé']);
  });

  it('mélange l’ordre du bulletin', () => {
    const state = dictating(drafted(started()), { shuffle: reverseOrder });
    expect(state.ballot).toEqual(['Chloé', 'Bob', 'real']);
  });

  it('ne lance la dictation que si l’hôte le demande', () => {
    const state = reduce(withFakes(drafted(started())), { k: 'advance', by: 'Bob' });
    expect(state.phase).toBe('DRAFT');
  });
});

describe('DICTATE et VOTE', () => {
  it('accepte un vote pendant le VOTE', () => {
    // Le bulletin est ['real', 'Bob', 'Chloé'] : Bob vote la fausse de Chloé.
    const state = reduce(voting(dictating(drafted(started()))), { k: 'vote', by: 'Bob', idx: 2 });
    expect(state.votes.Bob).toBe(2);
  });

  it('accepte un vote en mode vocal pendant la dictation', () => {
    const state = reduce(dictating(drafted(started())), { k: 'vote', by: 'Bob', idx: 2 });
    expect(state.votes.Bob).toBe(2);
  });

  it('refuse un vote en mode normal pendant la dictation', () => {
    const state = reduce(dictating(drafted(startedNormal())), { k: 'vote', by: 'Bob', idx: 1 });
    expect(state.votes.Bob).toBeUndefined();
  });

  it('refuse que le Chooser vote', () => {
    const state = reduce(voting(dictating(drafted(started()))), { k: 'vote', by: 'Alice', idx: 1 });
    expect(state.votes.Alice).toBeUndefined();
  });

  it('refuse que le joueur vote pour sa propre fausse', () => {
    // Le bulletin est ['real', 'Bob', 'Chloé'] : la fausse de Bob est l'option 1.
    const state = reduce(voting(dictating(drafted(started()))), { k: 'vote', by: 'Bob', idx: 1 });
    expect(state.votes.Bob).toBeUndefined();
    expect(state.errors.Bob).toBe(MESSAGES.ownFake);
  });

  it('laisse le joueur voter pour une autre option ensuite', () => {
    let state = reduce(voting(dictating(drafted(started()))), { k: 'vote', by: 'Bob', idx: 1 });
    state = reduce(state, { k: 'vote', by: 'Bob', idx: 0 });
    expect(state.votes.Bob).toBe(0);
    expect(state.errors.Bob).toBeUndefined();
  });

  it('rend le vote irrévocable', () => {
    let state = reduce(voting(dictating(drafted(started()))), { k: 'vote', by: 'Bob', idx: 0 });
    state = reduce(state, { k: 'vote', by: 'Bob', idx: 2 });
    expect(state.votes.Bob).toBe(0);
  });

  it('refuse un index hors du bulletin', () => {
    const state = reduce(voting(dictating(drafted(started()))), { k: 'vote', by: 'Bob', idx: 9 });
    expect(state.votes.Bob).toBeUndefined();
  });

  it('ne change rien à l’état quand l’action est refusée', () => {
    const state = voting(dictating(drafted(started())));
    const after = reduce(state, { k: 'vote', by: 'Bob', idx: 99 });
    expect(after).toBe(state);
  });
});

describe('REVEAL et END', () => {
  it('révèle et compte les points de la manche', () => {
    let state = voting(dictating(drafted(started())));
    state = reduce(state, { k: 'vote', by: 'Bob', idx: 0 }); // la vraie définition
    state = reduce(state, { k: 'vote', by: 'Chloé', idx: 1 }); // la fausse de Bob
    state = reduce(state, { k: 'reveal', by: 'Alice' });
    expect(state.phase).toBe('REVEAL');
    // Bob a trouvé la vraie (+1) et sa fausse a récolté un vote (+1).
    expect(state.scores).toEqual({ Bob: 2 });
  });

  it('laisse l’hôte révéler même si tout le monde n’a pas voté', () => {
    const state = reduce(voting(dictating(drafted(started()))), { k: 'reveal', by: 'Alice' });
    expect(state.phase).toBe('REVEAL');
  });

  it('cumule les scores d’une manche à l’autre', () => {
    let state = revealed(started());
    state = reduce(state, { k: 'next', by: 'Alice' });
    state = drafted(state);
    state = dictating(state);
    state = voting(state);
    state = reduce(state, { k: 'vote', by: 'Alice', idx: 0 });
    state = reduce(state, { k: 'reveal', by: 'Alice' });
    expect(state.scores.Alice).toBe(1);
  });

  it('fait tourner le Chooser dans l’ordre d’arrivée, puis revient au début', () => {
    const choosers: string[] = [];
    let state = started();
    for (let round = 1; round <= 6; round += 1) {
      choosers.push(state.chooser!);
      state = drafted(state);
      state = dictating(state);
      state = voting(state);
      state = reduce(state, { k: 'reveal', by: 'Alice' });
      state = reduce(state, { k: 'next', by: 'Alice' });
    }
    expect(choosers).toEqual(['Alice', 'Bob', 'Chloé', 'Alice', 'Bob', 'Chloé']);
    expect(state.phase).toBe('END');
  });

  it('remet les scores et le compteur de manches à zéro avec « Rejouer »', () => {
    let state = started();
    for (let round = 1; round <= 6; round += 1) {
      state = drafted(state);
      state = dictating(state);
      state = voting(state);
      state = reduce(state, { k: 'reveal', by: 'Alice' });
      state = reduce(state, { k: 'next', by: 'Alice' });
    }
    state = reduce(state, { k: 'replay', by: 'Alice' });
    expect(state.phase).toBe('LOBBY');
    expect(state.scores).toEqual({});
    expect(state.round).toBe(0);
    expect(state.chooser).toBeNull();
    expect(state.seats).toEqual(PLAYERS);
  });

  it('laisse l’hôte terminer la partie à tout moment', () => {
    const state = reduce(drafted(started()), { k: 'end', by: 'Alice' });
    expect(state.phase).toBe('END');
  });

  it('ne compte pas les points d’une manche inachevée', () => {
    let state = voting(dictating(drafted(started())));
    state = reduce(state, { k: 'vote', by: 'Bob', idx: 0 });
    state = reduce(state, { k: 'end', by: 'Alice' });
    expect(state.scores).toEqual({});
  });
});

describe('la déconnexion', () => {
  it('garde le siège déconnecté dans la table', () => {
    let state = started();
    state = reduce(state, { k: 'leave', by: 'Chloé' });
    expect(state.seats).toEqual(PLAYERS);
    expect(state.connected.Chloé).toBe(false);
  });

  it('bloque la dictation', () => {
    let state = withFakes(drafted(started()));
    state = reduce(state, { k: 'leave', by: 'Chloé' });
    state = reduce(state, { k: 'advance', by: 'Alice' });
    expect(state.phase).toBe('DRAFT');
  });

  it('bloque le révél', () => {
    let state = voting(dictating(drafted(started())));
    state = reduce(state, { k: 'leave', by: 'Chloé' });
    state = reduce(state, { k: 'reveal', by: 'Alice' });
    expect(state.phase).toBe('VOTE');
  });

  it('laisse l’hôte terminer la partie malgré la déconnexion', () => {
    let state = voting(dictating(drafted(started())));
    state = reduce(state, { k: 'leave', by: 'Chloé' });
    state = reduce(state, { k: 'end', by: 'Alice' });
    expect(state.phase).toBe('END');
  });

  it('laisse le joueur revenir reprendre sa place', () => {
    let state = started();
    state = reduce(state, { k: 'leave', by: 'Chloé' });
    state = reduce(state, { k: 'hello', name: 'Chloé' });
    expect(state.connected.Chloé).toBe(true);
    const after = reduce(state, { k: 'pick', by: 'Alice', w: 'Iguane', p: '', d: 'Un lézard.' });
    expect(after.phase).toBe('DRAFT');
  });
});

describe('le retour de l’hôte', () => {
  it('déconnecte tous les autres sièges', () => {
    let state = started();
    state = reduce(state, { k: 'hostBack', by: 'Alice' });
    expect(state.connected.Alice).toBe(true);
    expect(state.connected.Bob).toBe(false);
    expect(state.connected.Chloé).toBe(false);
  });

  it('laisse les joueurs reprendre leur place', () => {
    let state = started();
    state = reduce(state, { k: 'hostBack', by: 'Alice' });
    state = reduce(state, { k: 'hello', name: 'Bob' });
    state = reduce(state, { k: 'hello', name: 'Chloé' });
    expect(state.connected.Bob).toBe(true);
    expect(state.connected.Chloé).toBe(true);
  });
});

describe('le doublon de pseudo', () => {
  it('note le message pour ce pseudo', () => {
    const state = reduce(lobby(), { k: 'duplicate', by: 'Bob' });
    expect(state.errors.Bob).toBe(MESSAGES.pseudoTaken);
  });

  it('ne note rien pour un pseudo qui n’est pas à la table', () => {
    const before = lobby();
    expect(reduce(before, { k: 'duplicate', by: 'Zoé' })).toBe(before);
  });

  it('ne double pas le siège', () => {
    const state = reduce(lobby(), { k: 'duplicate', by: 'Bob' });
    expect(state.seats).toEqual(['Alice', 'Bob', 'Chloé']);
  });
});
