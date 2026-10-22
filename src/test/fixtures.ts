/**
 * Des parties prefabricadas, pour tester l'affichage sans le réseau.
 *
 * Ce module n'est importé que par des tests : il n'entre jamais dans le
 * bundle de l'application.
 */

import { reduce } from '../game/reduce';
import { expectedWriters, initialState, type State } from '../game/state';

export const PLAYERS = ['Alice', 'Bob', 'Chloé'];
export const HOST = 'Alice';
export const WRITERS = ['Bob', 'Chloé'];

const keepOrder = (items: readonly (string | 'real')[]) => items.slice();

export type FixtureStop =
  | 'LOBBY'
  | 'PICK'
  | 'DRAFT'
  | 'DRAFT_SUBMITTED'
  | 'DICTATE'
  | 'VOTE'
  | 'VOTE_VOTED'
  | 'REVEAL'
  | 'END';

/** L'état de la partie, arrêté à un point précis. */
export function gameFixture(stopAt: FixtureStop, vocal = true): State {
  let state = initialState();
  for (const name of PLAYERS) state = reduce(state, { k: 'hello', name });
  // `vocal` : les définitions ne sont pas affichées, le vote ouvre à la
  // dictée. L'état porte l'inverse (§4.5).
  state = reduce(state, { k: 'setOptions', by: HOST, showDefinitions: !vocal, tours: 2 });
  if (stopAt === 'LOBBY') return state;

  state = reduce(state, { k: 'start', by: HOST });
  if (stopAt === 'PICK') return state;

  state = reduce(state, {
    k: 'pick',
    by: state.chooser!,
    w: 'Éléphant',
    p: 'n.m.',
    d: 'Un grand mammifère.',
  });
  if (stopAt === 'DRAFT') return state;

  for (const writer of expectedWriters(state)) {
    state = reduce(state, { k: 'def', by: writer, text: `Fausse de ${writer}` });
  }
  if (stopAt === 'DRAFT_SUBMITTED') return state;

  state = reduce(state, { k: 'advance', by: HOST }, { shuffle: keepOrder });
  if (stopAt === 'DICTATE') return state;

  state = reduce(state, { k: 'valid', by: state.chooser! });
  if (stopAt === 'VOTE') return state;

  state = reduce(state, { k: 'vote', by: 'Bob', idx: 0 });
  state = reduce(state, { k: 'vote', by: 'Chloé', idx: 1 });
  if (stopAt === 'VOTE_VOTED') return state;

  state = reduce(state, { k: 'reveal', by: HOST });
  if (stopAt === 'REVEAL') return state;

  for (let round = 2; round <= 6; round += 1) {
    state = reduce(state, { k: 'next', by: HOST });
    state = reduce(state, {
      k: 'pick',
      by: state.chooser!,
      w: 'Éléphant',
      p: 'n.m.',
      d: 'Un grand mammifère.',
    });
    for (const writer of expectedWriters(state)) {
      state = reduce(state, { k: 'def', by: writer, text: `Fausse de ${writer}` });
    }
    state = reduce(state, { k: 'advance', by: HOST }, { shuffle: keepOrder });
    state = reduce(state, { k: 'valid', by: state.chooser! });
    state = reduce(state, { k: 'reveal', by: HOST });
  }
  return reduce(state, { k: 'next', by: HOST });
}
