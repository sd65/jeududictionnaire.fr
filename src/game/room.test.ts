import { describe, expect, it } from 'vitest';
import { isValidRoomCode, newRoomCode, roomFromUrl, roomToUrl } from './room';

describe('le code de salle', () => {
  it('est fait de quatre lettres', () => {
    expect(isValidRoomCode('ABCD')).toBe(true);
    expect(isValidRoomCode('ABC')).toBe(false);
    expect(isValidRoomCode('ABCDE')).toBe(false);
    expect(isValidRoomCode('AB1D')).toBe(false);
    expect(isValidRoomCode('abcd')).toBe(false);
  });

  it('est tiré au hasard parmi les vingt-six lettres', () => {
    // Un tirage déterministe : la première lettre, puis les suivantes.
    const values = [0, 0.5, 0.999, 0.25];
    let index = 0;
    const code = newRoomCode(() => values[index++]!);
    expect(code).toBe('ANZG');
    expect(isValidRoomCode(code)).toBe(true);
  });

  it('ne sort jamais des lettres', () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      expect(isValidRoomCode(newRoomCode())).toBe(true);
    }
  });

  it('se lit dans l’URL, en majuscules', () => {
    expect(roomFromUrl('?room=abcd')).toBe('ABCD');
    expect(roomFromUrl('?foo=1&room=wxyz')).toBe('WXYZ');
    expect(roomFromUrl('?room=%20abcd%20')).toBe('ABCD');
  });

  it('ignore une URL sans code, ou avec un code mal formé', () => {
    expect(roomFromUrl('')).toBeNull();
    expect(roomFromUrl('?room=')).toBeNull();
    expect(roomFromUrl('?room=ab')).toBeNull();
    expect(roomFromUrl('?room=abcd1')).toBeNull();
    expect(roomFromUrl('?room=éèàç')).toBeNull();
  });

  it('se transporte en minuscules', () => {
    expect(roomToUrl('ABCD')).toBe('?room=abcd');
    expect(roomToUrl(' abcd ')).toBe('?room=abcd');
  });
});
