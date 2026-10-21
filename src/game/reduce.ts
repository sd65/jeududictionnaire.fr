/**
 * Le réducteur : la machine à phases du plan (§6.2).
 *
 * Seul l'hôte l'exécute (§6.6) : les invités envoient des intentions, l'hôte
 * les valide et diffuse l'état entier. Une action refusée ne change rien et
 * rend l'état *strictement identique* — l'appelant peut donc comparer les
 * références pour savoir s'il y a eu un changement.
 *
 * Deux dépendances, injectées pour rester testable :
 * - `excluded` : les mots qui ne peuvent plus être joués (§3 PICK) ;
 * - `shuffle`  : le mélange qui fige l'ordre 1…N du bulletin (§4.3).
 */

import { MESSAGES } from '../ui/text';
import { addPoints, roundPoints } from './scoring';
import {
  expectedWriters,
  hostOf,
  isValidPseudo,
  seatIndex,
  totalRounds,
  type Author,
  type State,
} from './state';
import { normalize } from './words';

export type Action =
  /** Un joueur arrive ou revient (§3 LOBBY, §4.9). */
  | { k: 'hello'; name: string }
  /** L'hôte change les options de la table (§3 LOBBY). */
  | { k: 'setOptions'; by: string; vocal: boolean; tours: number }
  /** L'hôte lance la partie : LOBBY → PICK. */
  | { k: 'start'; by: string }
  /** Le Chooser choisit un mot : PICK → DRAFT. */
  | { k: 'pick'; by: string; w: string; p: string; d: string }
  /** Un joueur envoie sa fausse définition (DRAFT). */
  | { k: 'def'; by: string; text: string }
  /** Le Chooser déclare que tout le monde a entendu : DICTATE → VOTE. */
  | { k: 'valid'; by: string }
  /** Un joueur vote (VOTE, et DICTATE en mode vocal). */
  | { k: 'vote'; by: string; idx: number }
  /** L'hôte fait passer la dictation : DRAFT → DICTATE. */
  | { k: 'advance'; by: string }
  /** L'hôte révèle : VOTE → REVEAL. */
  | { k: 'reveal'; by: string }
  /** L'hôte passe à la manche suivante : REVEAL → PICK, ou → END. */
  | { k: 'next'; by: string }
  /** L'hôte termine la partie : n'importe quelle phase → END. */
  | { k: 'end'; by: string }
  /** L'hôte relance : END → LOBBY. */
  | { k: 'replay'; by: string }
  /** Un siège se déconnecte (§4.12). */
  | { k: 'leave'; by: string }
  /** L'hôte revient après un rechargement : les autres sièges sont déconnectés (§6.5). */
  | { k: 'hostBack'; by: string }
  /** Le joueur efface le message qui lui est adressé. */
  | { k: 'dismissError'; by: string };

export type ReduceDeps = {
  /** Les mots déjà joués, normalisés (§3 PICK). */
  excluded?: ReadonlySet<string> | undefined;
  /** Le mélange qui fige l'ordre du bulletin (§4.3). */
  shuffle?: ((items: readonly Author[]) => Author[]) | undefined;
};

const MAX_FAKE_LENGTH = 500;

/** Un siège déconnecté bloque la partie (§4.12). */
export function isBlocked(state: State): boolean {
  return state.seats.some((seat) => !state.connected[seat]);
}

function withoutError(errors: Record<string, string>, seat: string): Record<string, string> {
  if (!(seat in errors)) return errors;
  const next = { ...errors };
  delete next[seat];
  return next;
}

function withError(
  errors: Record<string, string>,
  seat: string,
  message: string,
): Record<string, string> {
  return { ...withoutError(errors, seat), [seat]: message };
}

/** Les données d'une manche, vidées entre deux manches. */
function clearRound(): Pick<
  State,
  'word' | 'category' | 'realDef' | 'fakes' | 'ballot' | 'votes'
> {
  return {
    word: '',
    category: '',
    realDef: '',
    fakes: {},
    ballot: [],
    votes: {},
  };
}

function defaultShuffle(items: readonly Author[]): Author[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

export function reduce(state: State, action: Action, deps: ReduceDeps = {}): State {
  const host = hostOf(state);
  const isHost = (by: string) => by !== '' && by === host;

  switch (action.k) {
    /* ---------------------------------------------------------------- LOBBY */

    case 'hello': {
      const name = action.name.trim();
      // Un pseudo invalide est refusé par le client (§4.16) ; l'hôte le
      // refuse aussi, silencieusement.
      if (!isValidPseudo(name)) return state;

      const existing = seatIndex(state, name);
      if (existing >= 0) {
        // Le pseudo est déjà pris. Si le siège est déconnecté, c'est un
        // retour : on le reprend (§4.9). S'il est connecté, c'est un
        // doublon : refusé, et le client le déduit de l'état (§4.16).
        const seat = state.seats[existing]!;
        if (state.connected[seat]) return state;
        return { ...state, connected: { ...state.connected, [seat]: true } };
      }

      // Pas de place après le démarrage (§4.8) : refusé silencieusement.
      if (state.phase !== 'LOBBY') return state;

      return {
        ...state,
        seats: [...state.seats, name],
        connected: { ...state.connected, [name]: true },
      };
    }

    case 'setOptions': {
      if (state.phase !== 'LOBBY' || !isHost(action.by)) return state;
      const tours = Math.max(1, Math.floor(action.tours));
      return { ...state, vocal: action.vocal, tours };
    }

    case 'start': {
      if (state.phase !== 'LOBBY' || !isHost(action.by)) return state;
      // Au moins trois joueurs, et tout le monde connecté (§3 LOBBY).
      if (state.seats.length < 3) return state;
      if (isBlocked(state)) return state;
      return {
        ...state,
        phase: 'PICK',
        round: 1,
        // Le Chooser est le premier arrivé ; il tournera ensuite dans l'ordre
        // d'arrivée, et reviendra au début (§5).
        chooser: state.seats[0]!,
        errors: {},
        ...clearRound(),
      };
    }

    /* ----------------------------------------------------------------- PICK */

    case 'pick': {
      if (state.phase !== 'PICK') return state;
      if (action.by !== state.chooser) return state;
      if (isBlocked(state)) return state;

      const word = action.w.trim();
      const definition = action.d.trim();
      // La définition est obligatoire : le Chooser doit pouvoir y répondre
      // (§3 PICK). Aucune validation de contenu.
      if (!word || !definition) return state;

      const excluded = deps.excluded;
      if (excluded?.has(normalize(word))) {
        return {
          ...state,
          errors: withError(state.errors, action.by, MESSAGES.wordAlreadyPlayed),
        };
      }

      return {
        ...state,
        phase: 'DRAFT',
        word,
        category: action.p.trim(),
        realDef: definition,
        // La manche repart à zéro : pas de faux, pas de bulletin, pas de vote.
        fakes: {},
        ballot: [],
        votes: {},
        errors: withoutError(state.errors, action.by),
      };
    }

    /* ---------------------------------------------------------------- DRAFT */

    case 'def': {
      if (state.phase !== 'DRAFT') return state;
      // Le Chooser n'écrit pas (§4.1) ; un joueur non assis non plus.
      if (action.by === state.chooser) return state;
      if (seatIndex(state, action.by) < 0) return state;
      // Une fois par manche : le faux est verrouillé après l'envoi (§3 DRAFT).
      if (action.by in state.fakes) return state;

      const text = action.text.trim();
      if (!text || text.length > MAX_FAKE_LENGTH) return state;

      return {
        ...state,
        fakes: { ...state.fakes, [action.by]: text },
        errors: withoutError(state.errors, action.by),
      };
    }

    case 'advance': {
      // L'hôte lance la dictation, une fois que tous les rédacteurs ont
      // envoyé leur fausse définition (§3 DRAFT).
      if (state.phase !== 'DRAFT' || !isHost(action.by)) return state;
      if (isBlocked(state)) return state;

      const writers = expectedWriters(state);
      if (!writers.every((writer) => writer in state.fakes)) return state;

      const shuffle = deps.shuffle ?? defaultShuffle;
      const ballot = shuffle(['real', ...writers]);

      return { ...state, phase: 'DICTATE', ballot, errors: {} };
    }

    /* -------------------------------------------------------------- DICTATE */

    case 'valid': {
      // Le Chooser déclare que tout le monde a entendu (§3 DICTATE).
      if (state.phase !== 'DICTATE') return state;
      if (action.by !== state.chooser) return state;
      if (isBlocked(state)) return state;
      return { ...state, phase: 'VOTE', errors: {} };
    }

    /* ----------------------------------------------------------------- VOTE */

    case 'vote': {
      // Le vote est accepté exactement quand le bulletin est visible à ce
      // joueur : une seule expression, dans les deux modes (§3 VOTE, §4.2).
      const visible = state.phase === 'VOTE' || (state.phase === 'DICTATE' && state.vocal);
      if (!visible) return state;
      if (action.by === state.chooser) return state;
      if (seatIndex(state, action.by) < 0) return state;
      // Un vote, irrévocable (§3 VOTE).
      if (action.by in state.votes) return state;

      const index = action.idx;
      if (!Number.isInteger(index) || index < 0 || index >= state.ballot.length) return state;

      const author = state.ballot[index];
      if (author === undefined) return state;

      // On ne vote pas pour sa propre fausse définition (§3 VOTE).
      if (author === action.by) {
        return {
          ...state,
          errors: withError(state.errors, action.by, MESSAGES.ownFake),
        };
      }

      return {
        ...state,
        votes: { ...state.votes, [action.by]: index },
        errors: withoutError(state.errors, action.by),
      };
    }

    /* --------------------------------------------------------------- REVEAL */

    case 'reveal': {
      // L'hôte révèle, même si tout le monde n'a pas voté (§4.10).
      if (state.phase !== 'VOTE' || !isHost(action.by)) return state;
      if (isBlocked(state)) return state;

      const points = roundPoints(state.ballot, state.votes);
      return {
        ...state,
        phase: 'REVEAL',
        scores: addPoints(state.scores, points),
        errors: {},
      };
    }

    case 'next': {
      if (state.phase !== 'REVEAL' || !isHost(action.by)) return state;
      if (isBlocked(state)) return state;

      if (state.round >= totalRounds(state)) {
        return { ...state, phase: 'END', errors: {} };
      }

      // Le Chooser tourne dans l'ordre d'arrivée, et revient au début (§5).
      const index = state.chooser ? state.seats.indexOf(state.chooser) : -1;
      const chooser = state.seats[(index + 1) % state.seats.length]!;

      return {
        ...state,
        ...clearRound(),
        phase: 'PICK',
        round: state.round + 1,
        chooser,
        errors: {},
      };
    }

    /* ------------------------------------------------------------------ END */

    case 'end': {
      // La seule sortie d'une partie bloquée (§4.12). Les points de la
      // manche inachevée ne sont pas comptés : ils ne sont jamais ajoutés.
      if (state.phase === 'END' || !isHost(action.by)) return state;
      return { ...state, ...clearRound(), phase: 'END', errors: {} };
    }

    case 'replay': {
      // « Rejouer » : on revient au LOBBY avec les mêmes joueurs et pseudos,
      // les scores et le compteur de manches à zéro (§5).
      if (state.phase !== 'END' || !isHost(action.by)) return state;
      return {
        ...state,
        ...clearRound(),
        phase: 'LOBBY',
        round: 0,
        chooser: null,
        scores: {},
        errors: {},
      };
    }

    /* ------------------------------------------------------- Connexions */

    case 'leave': {
      if (seatIndex(state, action.by) < 0) return state;
      if (state.connected[action.by] === false) return state;
      return { ...state, connected: { ...state.connected, [action.by]: false } };
    }

    case 'hostBack': {
      // L'hôte revient après un rechargement : tous les autres sièges sont
      // déconnectés jusqu'à ce que leurs propriétaires disent bonjour (§6.5).
      if (!isHost(action.by)) return state;
      const connected: Record<string, boolean> = {};
      for (const seat of state.seats) connected[seat] = seat === action.by;
      return { ...state, connected };
    }

    case 'dismissError': {
      if (!(action.by in state.errors)) return state;
      return { ...state, errors: withoutError(state.errors, action.by) };
    }

    default:
      return state;
  }
}
