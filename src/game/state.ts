/**
 * L'état du jeu, exactement les champs du plan (§6.6) — ni un de plus.
 *
 * Un seul état existe : l'hôte le détient et le diffuse tel quel (§4.2).
 * Chaque appareil dérive ce qu'il a le droit de dessiner de ce même état,
 * via `project(state, me)` (§4.2, dans `project.ts`).
 */

export type Phase = 'LOBBY' | 'PICK' | 'DRAFT' | 'DICTATE' | 'VOTE' | 'REVEAL' | 'END';

/** L'auteur d'une option du bulletin : un pseudo, ou 'real' pour la vraie. */
export type Author = string | 'real';

export type State = {
  phase: Phase;
  /** Les pseudos, dans l'ordre d'arrivée (`seats[0]` est l'hôte). */
  seats: string[];
  /** Par siège : est-il connecté ? */
  connected: Record<string, boolean>;
  /** Par siège : un message adressé à ce siège seul. */
  errors: Record<string, string>;
  chooser: string | null;
  round: number;
  tours: number;
  /**
   * Les définitions sont-elles affichées aux joueurs pendant le vote (§4.5) ?
   *
   * `false` — le défaut — : les téléphones ne montrent que des numéros, et le
   * vote est ouvert dès la dictée. `true` : les définitions s'affichent au
   * VOTE, et le vote n'ouvre qu'à ce moment-là.
   */
  showDefinitions: boolean;
  word: string;
  category: string;
  realDef: string;
  /** pseudo → la fausse définition qu'il a envoyée. */
  fakes: Record<string, string>;
  /** L'ordre 1…N gelé du bulletin, par auteur. */
  ballot: Author[];
  /** pseudo → l'index (0-based) de l'option votée. */
  votes: Record<string, number>;
  scores: Record<string, number>;
};

export function initialState(): State {
  return {
    phase: 'LOBBY',
    seats: [],
    connected: {},
    errors: {},
    chooser: null,
    round: 0,
    tours: 2,
    showDefinitions: false,
    word: '',
    category: '',
    realDef: '',
    fakes: {},
    ballot: [],
    votes: {},
    scores: {},
  };
}

/**
 * Le nombre total de manches : `tours × N`, calculé une fois pour toutes au
 * démarrage (§4.1). Le nombre de sièges est gelé au démarrage, et les
 * options ne s'éditent qu'au LOBBY : ce produit est donc constant pendant
 * toute la partie.
 */
export function totalRounds(state: State): number {
  return state.tours * state.seats.length;
}

/** Les joueurs attendus comme rédacteurs : tous les sièges moins le Chooser (§4.1). */
export function expectedWriters(state: State): string[] {
  return state.seats.filter((seat) => seat !== state.chooser);
}

/** L'hôte est le premier arrivé (§6.6 : `seats[0]` est l'hôte). */
export function hostOf(state: State): string | null {
  return state.seats[0] ?? null;
}

/** Le pseudo est-il valide ? 3 à 20 caractères, lettres (accents compris) et chiffres (§3 LOBBY). */
export function isValidPseudo(pseudo: string): boolean {
  return /^[\p{L}\p{N}]{3,20}$/u.test(pseudo.trim());
}

/** Les pseudos se comparent sans casse : « Léa » et « léa » se marchent dessus (§3 LOBBY). */
export function samePseudo(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** L'index du siège portant ce pseudo, sans tenir compte de la casse. */
export function seatIndex(state: State, pseudo: string): number {
  return state.seats.findIndex((seat) => samePseudo(seat, pseudo));
}

/**
 * Le pseudo est-il déjà pris ? (§3 LOBBY)
 *
 * Un siège **connecté** qui le porte suffit : c'est un doublon. Un siège
 * déconnecté, non : reprendre ce siège est un retour, pas un doublon
 * (§4.9).
 */
export function isPseudoTaken(state: State, pseudo: string): boolean {
  const index = seatIndex(state, pseudo);
  if (index < 0) return false;
  return state.connected[state.seats[index]!] === true;
}
