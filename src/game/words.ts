/**
 * Les mots : normalisation, mélange, exclusion, pioche.
 *
 * Tout est pur, sans état ni réseau — c'est ce qui permet de tester les
 * règles du jeu sans navigateur (§6.7).
 */

/** Une entrée du pack `data/wordlist.json` (§6.3). */
export type Word = {
  /** Le mot. */
  w: string;
  /** La catégorie ou le genre, tel quel dans le pack (« n.m. », « adj. »…). */
  p: string;
  /** La vraie définition. */
  d: string;
};

/**
 * Comparaison insensible à la casse et aux accents : « Éléphant » et
 * « elephant » sont le même mot (§3 PICK, « Words are compared case- and
 * accent-insensitively »).
 */
export function normalize(word: string): string {
  return word
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/**
 * L'ensemble des mots exclus : l'historique local ∪ l'union reçue (§4.4).
 * C'est le seul ensemble d'exclusion : les mots déjà joués dans la partie en
 * cours sont dans l'historique local, puisque la diffusion de DRAFT les y
 * ajoute.
 */
export function excludedSet(
  local: readonly string[],
  union: readonly string[],
): Set<string> {
  const set = new Set<string>();
  for (const word of local) set.add(normalize(word));
  for (const word of union) set.add(normalize(word));
  return set;
}

/** Mélange de Fisher–Yates : une permutation, rien de plus. */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/**
 * La pioche du Chooser : 100 cartes tirées au hasard dans le pack, après
 * exclusions (§3 PICK). Si le pack ne fournit pas 100 cartes éligibles, la
 * pioche est simplement plus courte ; la saisie manuelle reste possible.
 */
export function deck(
  words: readonly Word[],
  excluded: ReadonlySet<string>,
  count = 100,
): Word[] {
  const eligible = words.filter((word) => !excluded.has(normalize(word.w)));
  return shuffle(eligible).slice(0, count);
}

/**
 * La navigation dans la pioche est **circulaire** : après la dernière carte,
 * on revient à la première, et avant la première on tombe sur la dernière
 * (§3 PICK). La pioche elle-même n'est jamais remélangée pendant le PICK.
 */
export function deckIndex(current: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return (((current + delta) % length) + length) % length;
}
