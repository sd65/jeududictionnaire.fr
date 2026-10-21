import { describe, expect, it } from 'vitest';
import { initialState } from '../game/state';
import {
  decode,
  encode,
  guestAction,
  guestMessage,
  isGuestMessage,
  isHostMessage,
  type Message,
} from './protocol';

describe('le codage', () => {
  it('fait l’aller-retour de chaque message d’invité', () => {
    const messages: Message[] = [
      { k: 'hello', name: 'Léa', hist: ['iguane'] },
      { k: 'pick', w: 'Éléphant', p: 'n.m.', d: 'Un grand mammifère.' },
      { k: 'def', text: 'Une fausse définition.' },
      { k: 'vote', idx: 2 },
      { k: 'valid' },
    ];

    for (const message of messages) {
      expect(decode(encode(message))).toEqual(message);
    }
  });

  it('fait l’aller-retour des messages de l’hôte', () => {
    const state = { ...initialState(), seats: ['Alice'] };
    const messages: Message[] = [
      { k: 'state', state },
      { k: 'union', words: ['iguane', 'éléphant'] },
    ];

    for (const message of messages) {
      expect(decode(encode(message))).toEqual(message);
    }
  });

  it('ignore un `k` inconnu', () => {
    expect(decode(JSON.stringify({ k: 'pirate', x: 1 }))).toBeNull();
  });

  it('ignore un message mal formé', () => {
    expect(decode('pas du json')).toBeNull();
    expect(decode(JSON.stringify({ k: 'def' }))).toBeNull();
    expect(decode(JSON.stringify({ k: 'vote', idx: 0 }))).toBeNull();
    expect(decode(JSON.stringify({ k: 'vote', idx: 1.5 }))).toBeNull();
    expect(decode(JSON.stringify({ k: 'hello', name: 'Léa', hist: 'nope' }))).toBeNull();
    expect(decode(JSON.stringify({ k: 'state', state: { phase: 'NOPE' } }))).toBeNull();
    expect(decode(42)).toBeNull();
  });

  it('sait distinguer les deux sens', () => {
    expect(isGuestMessage(decode(encode({ k: 'valid' }))!)).toBe(true);
    expect(isHostMessage(decode(encode({ k: 'valid' }))!)).toBe(false);
    expect(isHostMessage(decode(encode({ k: 'union', words: [] }))!)).toBe(true);
  });
});

describe('la conversion en action', () => {
  it('ajoute le pseudo du joueur à chaque action', () => {
    const action = guestAction({ k: 'def', text: 'Fausse' }, 'Bob');
    expect(action).toEqual({ k: 'def', by: 'Bob', text: 'Fausse' });
  });

  it('transforme l’index 1…N du fil en index 0-based de l’état', () => {
    // Sur l'écran, le premier bouton est le numéro 1 ; dans l'état, c'est
    // l'index 0 du bulletin (décision 15, §13).
    expect(guestAction({ k: 'vote', idx: 1 }, 'Bob')).toEqual({ k: 'vote', by: 'Bob', idx: 0 });
    expect(guestAction({ k: 'vote', idx: 3 }, 'Bob')).toEqual({ k: 'vote', by: 'Bob', idx: 2 });
  });

  it('fait l’aller-retour vote → message → action', () => {
    const action = { k: 'vote', by: 'Bob', idx: 2 } as const;
    const message = guestMessage(action);
    expect(message).toEqual({ k: 'vote', idx: 3 });
    expect(guestAction(message!, 'Bob')).toEqual(action);
  });
});

describe('la conversion en message', () => {
  it('ne fait pas de message pour une action réservée à l’hôte', () => {
    expect(guestMessage({ k: 'start', by: 'Alice' })).toBeNull();
    expect(guestMessage({ k: 'reveal', by: 'Alice' })).toBeNull();
    expect(guestMessage({ k: 'replay', by: 'Alice' })).toBeNull();
  });

  it('accompagne le bonjour de l’historique local', () => {
    const message = guestMessage({ k: 'hello', name: 'Léa' }, ['iguane', 'éléphant']);
    expect(message).toEqual({ k: 'hello', name: 'Léa', hist: ['iguane', 'éléphant'] });
  });
});
