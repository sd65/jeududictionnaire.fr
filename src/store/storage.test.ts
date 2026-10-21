import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initialState } from '../game/state';
import {
  clearHost,
  clearRoom,
  isFresh,
  readHost,
  readName,
  readRoom,
  ROOM_TTL,
  writeHost,
  writeName,
  writeRoom,
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
