import { describe, expect, it } from 'vitest';
import { expectedWriters, type Author } from '../game/state';
import { createSession, type Session } from './session';
import { createMemoryTransport, flush } from './transport';

const keepOrder = (items: readonly Author[]) => items.slice();

type Table = {
  host: Session;
  bob: Session;
  chloe: Session;
  /** Combien de fois l'hôte a diffusé l'union. */
  unions: () => number;
  sessionOf: (pseudo: string) => Session;
};

/** Un salon neuf par table : les salons sont globaux au module. */
let roomCounter = 0;

function table(options: { hist?: string[] } = {}): Table {
  const code = `SALLE${(roomCounter += 1)}`;
  let unions = 0;

  const host = createSession({
    transport: createMemoryTransport('peer-host'),
    room: code,
    name: 'Alice',
    role: 'host',
    hist: options.hist,
    shuffle: keepOrder,
    onUnion: () => {
      unions += 1;
    },
  });
  const bob = createSession({
    transport: createMemoryTransport('peer-bob'),
    room: code,
    name: 'Bob',
    role: 'guest',
  });
  const chloe = createSession({
    transport: createMemoryTransport('peer-chloe'),
    room: code,
    name: 'Chloé',
    role: 'guest',
  });

  host.start();
  bob.start();
  chloe.start();
  flush();

  const sessionOf = (pseudo: string) => {
    if (pseudo === 'Alice') return host;
    if (pseudo === 'Bob') return bob;
    if (pseudo === 'Chloé') return chloe;
    throw new Error(`joueur inconnu : ${pseudo}`);
  };

  return { host, bob, chloe, unions: () => unions, sessionOf };
}

/** Des mots différents à chaque manche : un mot rejoué est refusé. */
const WORDS = ['Éléphant', 'Iguane', 'Chouette', 'Lézard', 'Tambour', 'Ananas'];
let wordIndex = 0;

/** Joue une manche complète : choix du mot, fausses, dictation, votes, révél. */
function playRound(t: Table, votes: Record<string, number> = {}): string {
  const chooser = t.host.store.getSnapshot().chooser!;
  const word = WORDS[wordIndex++ % WORDS.length]!;

  t.sessionOf(chooser).dispatch({
    k: 'pick',
    by: chooser,
    w: word,
    p: 'n.m.',
    d: 'Un grand mammifère.',
  });
  flush();

  // Chaque rédacteur — tous les joueurs sauf le Chooser — envoie sa fausse.
  for (const writer of expectedWriters(t.host.store.getSnapshot())) {
    t.sessionOf(writer).dispatch({ k: 'def', by: writer, text: `Fausse de ${writer}` });
  }
  flush();

  t.host.dispatch({ k: 'advance', by: 'Alice' });
  flush();

  t.sessionOf(chooser).dispatch({ k: 'valid', by: chooser });
  flush();

  for (const [who, idx] of Object.entries(votes)) {
    t.sessionOf(who).dispatch({ k: 'vote', by: who, idx });
    flush();
  }

  t.host.dispatch({ k: 'reveal', by: 'Alice' });
  flush();
  return word;
}

describe('une partie complète, entre trois appareils', () => {
  it('asseoit les trois joueurs, dans l’ordre d’arrivée', () => {
    const t = table();
    expect(t.host.store.getSnapshot().seats).toEqual(['Alice', 'Bob', 'Chloé']);
    expect(t.bob.view().isSeated).toBe(true);
    expect(t.chloe.view().isSeated).toBe(true);
  });

  it('donne à chaque appareil la même projection', () => {
    const t = table();
    const state = t.host.store.getSnapshot();
    expect(t.bob.store.getSnapshot()).toEqual(state);
    expect(t.chloe.store.getSnapshot()).toEqual(state);
  });

  it('démarre, joue, et va jusqu’à la fin', () => {
    const t = table();
    t.host.dispatch({ k: 'setOptions', by: 'Alice', vocal: true, tours: 1 });
    t.host.dispatch({ k: 'start', by: 'Alice' });
    flush();
    expect(t.host.store.getSnapshot().phase).toBe('PICK');

    // Trois manches : un tour.
    for (let round = 0; round < 3; round += 1) {
      playRound(t, { Bob: 0, Chloé: 1 });
      t.host.dispatch({ k: 'next', by: 'Alice' });
      flush();
    }

    expect(t.host.store.getSnapshot().phase).toBe('END');
    expect(t.bob.store.getSnapshot().phase).toBe('END');
  });

  it('compte les points du §5', () => {
    const t = table();
    t.host.dispatch({ k: 'setOptions', by: 'Alice', vocal: true, tours: 1 });
    t.host.dispatch({ k: 'start', by: 'Alice' });
    flush();

    // Le bulletin est ['real', 'Bob', 'Chloé'] : Bob trouve la vraie (+1),
    // Chloé vote la fausse de Bob (+1 à Bob).
    playRound(t, { Bob: 0, Chloé: 1 });
    t.host.dispatch({ k: 'next', by: 'Alice' });
    flush();

    expect(t.host.store.getSnapshot().scores).toEqual({ Bob: 2 });
  });

  it('refuse un vote pour sa propre fausse, et le dit au siège', () => {
    const t = table();
    t.host.dispatch({ k: 'setOptions', by: 'Alice', vocal: true, tours: 1 });
    t.host.dispatch({ k: 'start', by: 'Alice' });
    flush();

    t.host.dispatch({
      k: 'pick',
      by: 'Alice',
      w: 'Éléphant',
      p: 'n.m.',
      d: 'Un grand mammifère.',
    });
    flush();
    t.bob.dispatch({ k: 'def', by: 'Bob', text: 'Fausse de Bob' });
    t.chloe.dispatch({ k: 'def', by: 'Chloé', text: 'Fausse de Chloé' });
    flush();
    t.host.dispatch({ k: 'advance', by: 'Alice' });
    flush();

    // La fausse de Bob est l'option n°2 (index 1).
    t.bob.dispatch({ k: 'vote', by: 'Bob', idx: 1 });
    flush();

    expect(t.bob.store.getSnapshot().votes.Bob).toBeUndefined();
    expect(t.bob.view().myError).toBe('Tu ne peux pas voter pour ta propre définition.');
  });

  it('diffuse l’union à chaque arrivée de siège, et jamais par manche', () => {
    const t = table();
    // Deux invités sont arrivés : deux diffusions.
    expect(t.unions()).toBe(2);

    t.host.dispatch({ k: 'setOptions', by: 'Alice', vocal: true, tours: 1 });
    t.host.dispatch({ k: 'start', by: 'Alice' });
    flush();
    playRound(t, { Bob: 0, Chloé: 1 });
    t.host.dispatch({ k: 'next', by: 'Alice' });
    flush();

    // Les manches ne rediffusent pas l'union.
    expect(t.unions()).toBe(2);
  });

  it('envoie l’union aux invités, pour qu’ils excluent les mêmes mots', () => {
    const t = table({ hist: ['Éléphant'] });
    expect(t.bob.union()).toContain('elephant');
    expect(t.bob.excluded().has('elephant')).toBe(true);
  });

  it('ajoute à l’historique local le mot de chaque manche', () => {
    const t = table();
    t.host.dispatch({ k: 'setOptions', by: 'Alice', vocal: true, tours: 1 });
    t.host.dispatch({ k: 'start', by: 'Alice' });
    flush();
    const word = playRound(t);

    expect(t.bob.history()).toContain(word);
    expect(t.chloe.history()).toContain(word);
    expect(t.host.history()).toContain(word);
  });

  it('bloque la partie quand un joueur se déconnecte', () => {
    const t = table();
    t.host.dispatch({ k: 'setOptions', by: 'Alice', vocal: true, tours: 1 });
    t.host.dispatch({ k: 'start', by: 'Alice' });
    flush();

    t.host.dispatch({
      k: 'pick',
      by: 'Alice',
      w: 'Éléphant',
      p: 'n.m.',
      d: 'Un grand mammifère.',
    });
    flush();
    t.bob.dispatch({ k: 'def', by: 'Bob', text: 'Fausse de Bob' });
    t.chloe.dispatch({ k: 'def', by: 'Chloé', text: 'Fausse de Chloé' });
    flush();

    // Chloé ferme son onglet.
    t.chloe.leave();
    flush();

    expect(t.host.store.getSnapshot().connected.Chloé).toBe(false);
    t.host.dispatch({ k: 'advance', by: 'Alice' });
    flush();
    expect(t.host.store.getSnapshot().phase).toBe('DRAFT');
  });

  it('laisse revenir un joueur et reprendre sa place', () => {
    const t = table();
    t.host.dispatch({ k: 'setOptions', by: 'Alice', vocal: true, tours: 1 });
    t.host.dispatch({ k: 'start', by: 'Alice' });
    flush();

    t.chloe.leave();
    flush();
    expect(t.host.store.getSnapshot().connected.Chloé).toBe(false);

    // Chloé revient : elle redit bonjour.
    t.chloe.start();
    flush();

    expect(t.host.store.getSnapshot().connected.Chloé).toBe(true);
    expect(t.host.store.getSnapshot().seats).toEqual(['Alice', 'Bob', 'Chloé']);
  });

  it('montre à l’invité que l’hôte est parti', () => {
    const t = table();
    t.host.leave();
    flush();

    expect(t.bob.view().waitingFor).toEqual(['Alice']);
  });
});
