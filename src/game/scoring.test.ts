import { describe, expect, it } from 'vitest';
import { addPoints, rank, roundPoints } from './scoring';

describe('les points de la manche', () => {
  // Le bulletin est gelé : 0 = la vraie, 1 = la fausse de Bob, 2 = celle de Chloé.
  const ballot = ['real', 'Bob', 'Chloé'] as const;

  it('donne un point à l’auteur d’une fausse définition qui récolte un vote', () => {
    const points = roundPoints([...ballot], { Chloé: 1 });
    expect(points).toEqual({ Bob: 1 });
  });

  it('donne un point au joueur qui vote pour la vraie définition', () => {
    const points = roundPoints([...ballot], { Chloé: 0 });
    expect(points).toEqual({ Chloé: 1 });
  });

  it('cumule les deux effets : le votant et l’auteur', () => {
    // Bob vote pour la vraie (+1 à Bob), Chloé vote pour la fausse de Bob
    // (+1 à Bob). Chloé ne gagne rien : elle s'est trompée.
    const points = roundPoints([...ballot], { Bob: 0, Chloé: 1 });
    expect(points).toEqual({ Bob: 2 });
  });

  it('ne donne rien au Chooser : il ne vote pas, il n’écrit pas', () => {
    // Le réducteur refuse déjà le vote du Chooser ; le score de points ne fait
    // qu'appliquer la règle du plan.
    const points = roundPoints([...ballot], {});
    expect(points).toEqual({});
  });

  it('ignore un vote hors du bulletin', () => {
    const points = roundPoints([...ballot], { Bob: 99 });
    expect(points).toEqual({});
  });

  it('ne donne rien quand personne n’a voté', () => {
    expect(roundPoints([...ballot], {})).toEqual({});
  });
});

describe('les scores cumulés', () => {
  it('ajoute les points de la manche aux scores d’avant', () => {
    const total = addPoints({ Bob: 3, Chloé: 1 }, { Bob: 1 });
    expect(total).toEqual({ Bob: 4, Chloé: 1 });
  });

  it('ne touche pas au score des autres', () => {
    const before = { Chloé: 2 };
    expect(addPoints(before, { Bob: 1 })).toEqual({ Bob: 1, Chloé: 2 });
    expect(before).toEqual({ Chloé: 2 });
  });
});

describe('le classement', () => {
  it('range par score décroissant', () => {
    const standing = rank({ Alice: 1, Bob: 5, Chloé: 3 }, ['Alice', 'Bob', 'Chloé']);
    expect(standing.map((row) => row.seat)).toEqual(['Bob', 'Chloé', 'Alice']);
  });

  it('donne la même place aux ex æquo, et la place suivante suit immédiatement', () => {
    const standing = rank({ Alice: 3, Bob: 3, Chloé: 1 }, ['Alice', 'Bob', 'Chloé']);
    expect(standing.map((row) => row.place)).toEqual([1, 1, 2]);
  });

  it('donne des places distinctes pour des scores distincts', () => {
    const standing = rank({ Alice: 3, Bob: 2, Chloé: 1 }, ['Alice', 'Bob', 'Chloé']);
    expect(standing.map((row) => row.place)).toEqual([1, 2, 3]);
  });

  it('tranche les ex æquo par l’ordre d’arrivée', () => {
    const standing = rank({ Chloé: 2, Alice: 2 }, ['Alice', 'Chloé']);
    expect(standing.map((row) => row.seat)).toEqual(['Alice', 'Chloé']);
  });

  it('liste tous les joueurs, même à zéro point', () => {
    const standing = rank({ Bob: 2 }, ['Alice', 'Bob', 'Chloé']);
    expect(standing.map((row) => row.seat)).toEqual(['Bob', 'Alice', 'Chloé']);
    expect(standing.map((row) => row.score)).toEqual([2, 0, 0]);
  });

  it('gère un classement vide', () => {
    expect(rank({}, [])).toEqual([]);
  });
});
