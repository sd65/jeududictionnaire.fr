import { describe, expect, it } from 'vitest';
import {
  expectedWriters,
  hostOf,
  initialState,
  isValidPseudo,
  samePseudo,
  seatIndex,
  totalRounds,
  type State,
} from './state';

describe('l’état initial', () => {
  it('est au LOBBY, sans siège, sans Chooser, sans score', () => {
    const state = initialState();
    expect(state.phase).toBe('LOBBY');
    expect(state.seats).toEqual([]);
    expect(state.chooser).toBeNull();
    expect(state.scores).toEqual({});
  });

  it('n’a ni mot, ni bulletin, ni faux, ni vote', () => {
    const state = initialState();
    expect(state.word).toBe('');
    expect(state.category).toBe('');
    expect(state.realDef).toBe('');
    expect(state.ballot).toEqual([]);
    expect(state.fakes).toEqual({});
    expect(state.votes).toEqual({});
    expect(state.round).toBe(0);
  });

  it('est en mode vocal, avec deux tours', () => {
    const state = initialState();
    expect(state.vocal).toBe(true);
    expect(state.tours).toBe(2);
  });
});

describe('le nombre de manches', () => {
  it('vaut tours × le nombre de sièges', () => {
    const state: State = { ...initialState(), seats: ['Alice', 'Bob', 'Chloé'], tours: 2 };
    expect(totalRounds(state)).toBe(6);
  });

  it('vaut 0 tant que personne n’est assis', () => {
    expect(totalRounds(initialState())).toBe(0);
  });
});

describe('les rédacteurs attendus', () => {
  it('sont tous les sièges moins le Chooser', () => {
    const state: State = {
      ...initialState(),
      seats: ['Alice', 'Bob', 'Chloé'],
      chooser: 'Bob',
    };
    expect(expectedWriters(state)).toEqual(['Alice', 'Chloé']);
  });
});

describe('l’hôte', () => {
  it('est le premier arrivé', () => {
    const state: State = { ...initialState(), seats: ['Alice', 'Bob'] };
    expect(hostOf(state)).toBe('Alice');
  });

  it('n’existe pas dans une salle vide', () => {
    expect(hostOf(initialState())).toBeNull();
  });
});

describe('le pseudo', () => {
  it('accepte 3 à 20 lettres ou chiffres', () => {
    expect(isValidPseudo('Léa')).toBe(true);
    expect(isValidPseudo('abc')).toBe(true);
    expect(isValidPseudo('abcé9')).toBe(true);
    expect(isValidPseudo('a'.repeat(20))).toBe(true);
  });

  it('refuse trop court, trop long, ou avec des caractères interdits', () => {
    expect(isValidPseudo('ab')).toBe(false);
    expect(isValidPseudo('a'.repeat(21))).toBe(false);
    expect(isValidPseudo('abc def')).toBe(false);
    expect(isValidPseudo('abc-def')).toBe(false);
    expect(isValidPseudo('abc_1')).toBe(false);
    expect(isValidPseudo('')).toBe(false);
  });

  it('ignore les espaces autour', () => {
    expect(isValidPseudo('  Léa  ')).toBe(true);
  });

  it('ne se compare qu’à la casse près', () => {
    expect(samePseudo('Léa', 'léa')).toBe(true);
    expect(samePseudo('Léa', 'Léo')).toBe(false);
  });
});

describe('la recherche d’un siège', () => {
  it('trouve le siège sans tenir compte de la casse', () => {
    const state: State = { ...initialState(), seats: ['Alice', 'Léa'] };
    expect(seatIndex(state, 'léa')).toBe(1);
    expect(seatIndex(state, 'Zoé')).toBe(-1);
  });
});
