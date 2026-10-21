import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initialState } from '../game/state';
import { gameFixture } from '../test/fixtures';
import {
  clearHistory,
  clearHost,
  clearRoom,
  HISTORY_CAP,
  isFresh,
  readDraft,
  readHistory,
  readHost,
  readName,
  readRoom,
  savedGameFor,
  ROOM_TTL,
  writeDraft,
  writeHistory,
  writeHost,
  writeName,
  writeRoom,
  type HostSnapshot,
} from './storage';

/** Un localStorage de mentira, avec la même interface que le vrai. */
class FakeStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

const scope = globalThis as { window?: { localStorage: Storage } };
const real = scope.window;

beforeEach(() => {
  scope.window = { localStorage: new FakeStorage() };
});

afterEach(() => {
  if (real) scope.window = real;
  else delete scope.window;
});

describe('le pseudo par défaut', () => {
  it('fait l’aller-retour', () => {
    expect(readName()).toBe('');
    writeName('Léa');
    expect(readName()).toBe('Léa');
  });
});

describe('la sauvegarde de l’hôte', () => {
  it('fait l’aller-retour, avec l’état, le code et l’heure', () => {
    const state = { ...initialState(), phase: 'PICK' as const, seats: ['Alice'] };
    writeHost(state, 'ABCD', 1234);

    const snapshot = readHost();
    expect(snapshot?.at).toBe(1234);
    expect(snapshot?.code).toBe('ABCD');
    expect(snapshot?.state.phase).toBe('PICK');
    expect(snapshot?.state.seats).toEqual(['Alice']);
  });

  it('ignore une sauvegarde abîmée', () => {
    scope.window!.localStorage.setItem('jdd.host', 'pas du json');
    expect(readHost()).toBeNull();

    scope.window!.localStorage.setItem('jdd.host', JSON.stringify({ at: 'hier' }));
    expect(readHost()).toBeNull();

    scope.window!.localStorage.setItem('jdd.host', JSON.stringify({ state: { phase: 'PICK' } }));
    expect(readHost()).toBeNull();
  });

  it('se vide', () => {
    writeHost(initialState(), 'ABCD');
    clearHost();
    expect(readHost()).toBeNull();
  });
});

describe('la dernière salle', () => {
  it('fait l’aller-retour', () => {
    writeRoom('ABCD', 4321);
    expect(readRoom()).toEqual({ code: 'ABCD', seenAt: 4321 });
  });

  it('ignore une entrée abîmée', () => {
    scope.window!.localStorage.setItem('jdd.room', 'pas du json');
    expect(readRoom()).toBeNull();

    scope.window!.localStorage.setItem('jdd.room', JSON.stringify({ code: '' }));
    expect(readRoom()).toBeNull();
  });

  it('se vide', () => {
    writeRoom('ABCD');
    clearRoom();
    expect(readRoom()).toBeNull();
  });
});

describe('la fraîcheur d’une salle', () => {
  it('tient une heure', () => {
    const now = 1_000_000;
    expect(isFresh(now, now)).toBe(true);
    expect(isFresh(now - ROOM_TTL + 1000, now)).toBe(true);
    expect(isFresh(now - ROOM_TTL - 1000, now)).toBe(false);
    expect(isFresh(now - 10 * ROOM_TTL, now)).toBe(false);
  });
});

describe('sans stockage local', () => {
  it('ne casse rien', () => {
    delete scope.window;
    expect(readName()).toBe('');
    expect(readHost()).toBeNull();
    expect(readRoom()).toBeNull();
    expect(() => writeName('Léa')).not.toThrow();
    expect(() => writeHost(initialState(), 'ABCD')).not.toThrow();
    expect(() => clearRoom()).not.toThrow();
  });
});

describe('l’historique de mots', () => {
  it('fait l’aller-retour', () => {
    expect(readHistory()).toEqual([]);
    writeHistory(['iguane', 'éléphant']);
    expect(readHistory()).toEqual(['iguane', 'éléphant']);
  });

  it('ne garde que les trois mille derniers mots', () => {
    const words = Array.from({ length: HISTORY_CAP + 50 }, (_, index) => `mot-${index}`);
    writeHistory(words);
    const kept = readHistory();
    expect(kept).toHaveLength(HISTORY_CAP);
    expect(kept[0]).toBe('mot-50');
    expect(kept[kept.length - 1]).toBe(`mot-${words.length - 1}`);
  });

  it('ignore une entrée abîmée', () => {
    scope.window!.localStorage.setItem('jdd.hist', 'pas du json');
    expect(readHistory()).toEqual([]);
  });

  it('se vide', () => {
    writeHistory(['iguane']);
    clearHistory();
    expect(readHistory()).toEqual([]);
  });
});

describe('le texte non envoyé', () => {
  it('fait l’aller-retour, par salle', () => {
    expect(readDraft('ABCD')).toBe('');
    writeDraft('ABCD', 'Une fausse définition');
    expect(readDraft('ABCD')).toBe('Une fausse définition');
    // Une autre salle n’est pas concernée.
    expect(readDraft('WXYZ')).toBe('');
  });

  it('se vide quand on envoie', () => {
    writeDraft('ABCD', 'Une fausse définition');
    writeDraft('ABCD', '');
    expect(readDraft('ABCD')).toBe('');
  });
});

describe('la partie sauvegardée', () => {
  const state = gameFixture('END');

  it('est rendue pour sa propre salle', () => {
    const stored: HostSnapshot = { state, code: 'IBLA', at: Date.now() };
    expect(savedGameFor(stored, 'IBLA', 'Alice')).toBe(state);
  });

  it('n’est jamais rendue pour une autre salle', () => {
    // Une salle neuve ne doit pas hériter du classement de la partie
    // d'avant : c'est le bug du classement qui apparaissait dans une salle
    // où personne n'avait jamais joué.
    const stored: HostSnapshot = { state, code: 'IBLA', at: Date.now() };
    expect(savedGameFor(stored, 'WXYZ', 'Alice')).toBeNull();
  });

  it('exige le même hôte', () => {
    const stored: HostSnapshot = { state, code: 'IBLA', at: Date.now() };
    expect(savedGameFor(stored, 'IBLA', 'Bob')).toBeNull();
  });

  it('exige une partie fraîche', () => {
    const stored: HostSnapshot = { state, code: 'IBLA', at: Date.now() - ROOM_TTL - 1000 };
    expect(savedGameFor(stored, 'IBLA', 'Alice')).toBeNull();
  });

  it('ignore une partie sans joueurs', () => {
    const empty = gameFixture('LOBBY');
    const stored: HostSnapshot = {
      state: { ...empty, seats: [] },
      code: 'IBLA',
      at: Date.now(),
    };
    expect(savedGameFor(stored, 'IBLA', 'Alice')).toBeNull();
  });

  it('ne rend rien sans sauvegarde', () => {
    expect(savedGameFor(null, 'IBLA', 'Alice')).toBeNull();
  });
});
