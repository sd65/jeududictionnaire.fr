/**
 * Les points et le classement (§5).
 *
 * - une fausse définition qui récolte un vote : +1 à son auteur ;
 * - un joueur qui vote pour la vraie définition : +1 ;
 * - le Chooser : 0, par construction — sa récompense est sociale.
 */

import type { Author } from './state';

export type Points = Record<string, number>;

/**
 * Les points de la manche. Le bulletin est une liste d'auteurs (§4.3) : on en
 * déduit d'un coup l'auteur de chaque option et l'index de la vraie.
 */
export function roundPoints(ballot: readonly Author[], votes: Record<string, number>): Points {
  const points: Points = {};
  for (const [voter, index] of Object.entries(votes)) {
    const author = ballot[index];
    if (author === undefined) continue;
    if (author === 'real') {
      points[voter] = (points[voter] ?? 0) + 1;
    } else {
      points[author] = (points[author] ?? 0) + 1;
    }
  }
  return points;
}

/** Les scores cumulés : les scores d'avant plus les points de la manche. */
export function addPoints(scores: Record<string, number>, points: Points): Record<string, number> {
  const total: Record<string, number> = { ...scores };
  for (const [seat, value] of Object.entries(points)) {
    total[seat] = (total[seat] ?? 0) + value;
  }
  return total;
}

export type Standing = {
  seat: string;
  score: number;
  /** La place : les ex æquo partagent la même place, la suivante suit immédiatement. */
  place: number;
};

/**
 * Le classement final (§5) : **classement dense**, les ex æquo partagent la
 * place et la place suivante suit immédiatement (1, 1, 2).
 *
 * Tous les joueurs de la table y figurent, même à zéro point : l'écran de fin
 * montre la table entière.
 *
 * À score égal, l'ordre d'arrivée tranche — l'ordre du passage en salle, pas
 * l'alphabet.
 */
export function rank(scores: Record<string, number>, order: readonly string[]): Standing[] {
  const seats = [...order];
  for (const seat of Object.keys(scores)) {
    if (!seats.includes(seat)) seats.push(seat);
  }
  const index = new Map(seats.map((seat, i) => [seat, i]));

  const sorted = seats
    .map((seat) => ({ seat, score: scores[seat] ?? 0 }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (index.get(a.seat) ?? 0) - (index.get(b.seat) ?? 0);
    });

  const standings: Standing[] = [];
  let place = 0;
  let previous: number | undefined;
  for (const { seat, score } of sorted) {
    if (score !== previous) {
      place += 1;
      previous = score;
    }
    standings.push({ seat, score, place });
  }
  return standings;
}
