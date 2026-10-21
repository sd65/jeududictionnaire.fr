import { describe, expect, it } from 'vitest';
import { deck, deckIndex, excludedSet, normalize, shuffle, type Word } from './words';

describe('la normalisation', () => {
  it('ignore la casse et les accents', () => {
    expect(normalize('Éléphant')).toBe('elephant');
    expect(normalize('ÉLÉPHANT')).toBe('elephant');
    expect(normalize('  éléphant  ')).toBe('elephant');
  });

  it('laisse un mot sans accent intact', () => {
    expect(normalize('Chloé')).toBe('chloe');
    expect(normalize('définition')).toBe('definition');
  });
});

describe('l’ensemble des mots exclus', () => {
  it('réunit l’historique local et l’union reçue', () => {
    const set = excludedSet(['Éléphant'], ['Iguane']);
    expect(set.has('elephant')).toBe(true);
    expect(set.has('iguane')).toBe(true);
    expect(set.size).toBe(2);
  });

  it('ne garde qu’une fois un mot présent des deux côtés', () => {
    const set = excludedSet(['Iguane'], ['iguane']);
    expect(set.size).toBe(1);
  });
});

describe('le mélange', () => {
  it('est une permutation : rien ne perd, rien ne se duplique', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const mixed = shuffle(items);
    expect(mixed).toHaveLength(items.length);
    expect([...mixed].sort((a, b) => a - b)).toEqual(items);
  });

  it('ne touche pas à la liste d’origine', () => {
    const items = [1, 2, 3];
    shuffle(items);
    expect(items).toEqual([1, 2, 3]);
  });

  it('est reproductible avec un tirage donné', () => {
    const items = [1, 2, 3, 4, 5];
    const always = () => 0;
    expect(shuffle(items, always)).toEqual(shuffle(items, always));
  });
});

describe('la pioche', () => {
  const words: Word[] = [
    { w: 'Éléphant', p: 'n.m.', d: 'Un grand mammifère.' },
    { w: 'Iguane', p: 'n.m.', d: 'Un grand lézard.' },
    { w: 'Chloé', p: 'n.f.', d: 'Un prénom.' },
  ];

  it('ne contient que des mots éligibles', () => {
    const pile = deck(words, new Set(['elephant']));
    expect(pile.map((word) => word.w)).not.toContain('Éléphant');
    expect(pile).toHaveLength(2);
  });

  it('tient en 100 cartes', () => {
    const many: Word[] = Array.from({ length: 500 }, (_, i) => ({
      w: `mot${i}`,
      p: 'n.m.',
      d: 'Une définition.',
    }));
    expect(deck(many, new Set())).toHaveLength(100);
  });

  it('accepte un pack plus court que 100', () => {
    expect(deck(words, new Set())).toHaveLength(3);
  });

  it('accepte un pack entièrement exclu', () => {
    const pile = deck(words, new Set(['elephant', 'iguane', 'chloe']));
    expect(pile).toEqual([]);
  });
});

describe('la navigation dans la pioche', () => {
  it('tourne en rond', () => {
    expect(deckIndex(0, 1, 3)).toBe(1);
    expect(deckIndex(2, 1, 3)).toBe(0);
    expect(deckIndex(0, -1, 3)).toBe(2);
  });

  it('saute autant de cartes qu’on le demande', () => {
    expect(deckIndex(0, 3, 3)).toBe(0);
    expect(deckIndex(1, 2, 5)).toBe(3);
  });

  it('reste sage sur une pioche vide', () => {
    expect(deckIndex(0, 1, 0)).toBe(0);
    expect(deckIndex(3, -2, 0)).toBe(0);
  });
});
