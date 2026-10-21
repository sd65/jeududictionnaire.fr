/**
 * Le protocole : les messages qui voyagent sur l'unique canal de la salle
 * (§6.5). Un objet JSON avec un discriminant `k`.
 *
 * - de l'invité vers l'hôte : `hello`, `pick`, `def`, `vote`, `valid` ;
 * - de l'hôte vers les invités : `state` (l'état entier) et `union`
 *   (l'union des historiques).
 *
 * Il n'existe **aucun** message de refus : un échec d'action est enregistré
 * comme une erreur par siège et revient avec le prochain état ; un échec
 * d'arrivée se lit dans l'état lui-même.
 */

import type { Action } from '../game/reduce';
import { type Phase, type State } from '../game/state';

export const PHASES: readonly Phase[] = [
  'LOBBY',
  'PICK',
  'DRAFT',
  'DICTATE',
  'VOTE',
  'REVEAL',
  'END',
];

/* ----------------------------------------------------------- invité → hôte */

export type HelloMessage = {
  k: 'hello';
  /** Le pseudo : c'est l'identité du joueur (§4.9). */
  name: string;
  /** Les mots joués sur cet appareil, pour l'union (§4.4). */
  hist: string[];
};

export type PickMessage = {
  k: 'pick';
  w: string;
  p: string;
  d: string;
};

export type DefMessage = {
  k: 'def';
  text: string;
};

export type VoteMessage = {
  k: 'vote';
  /** L'option votée, **1…N** comme sur l'écran (§6.5). */
  idx: number;
};

export type ValidMessage = {
  k: 'valid';
};

export type GuestMessage =
  | HelloMessage
  | PickMessage
  | DefMessage
  | VoteMessage
  | ValidMessage;

/* --------------------------------------------------------------- hôte → invité */

export type StateMessage = {
  k: 'state';
  /** L'état entier : c'est la seule source de vérité (§4.2). */
  state: State;
};

export type UnionMessage = {
  k: 'union';
  /** L'union des historiques des appareils assis (§4.4). */
  words: string[];
};

export type HostMessage = StateMessage | UnionMessage;

export type Message = GuestMessage | HostMessage;

/* ------------------------------------------------------------------------ */

export function encode(message: Message): string {
  return JSON.stringify(message);
}

const isString = (value: unknown): value is string => typeof value === 'string';
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString);

function isState(value: unknown): value is State {
  if (!value || typeof value !== 'object') return false;
  const phase = (value as { phase?: unknown }).phase;
  return isString(phase) && (PHASES as readonly string[]).includes(phase);
}

/**
 * Décode un message. Un `k` inconnu, ou un message mal formé, est **ignoré** :
 * il ne fait pas planter l'application.
 */
export function decode(raw: unknown): Message | null {
  if (typeof raw !== 'string') return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;

  const kind = (data as { k?: unknown }).k;
  switch (kind) {
    case 'hello': {
      const { name, hist } = data as { name?: unknown; hist?: unknown };
      if (!isString(name) || !isStringArray(hist)) return null;
      return { k: 'hello', name, hist };
    }
    case 'pick': {
      const { w, p, d } = data as { w?: unknown; p?: unknown; d?: unknown };
      if (!isString(w) || !isString(p) || !isString(d)) return null;
      return { k: 'pick', w, p, d };
    }
    case 'def': {
      const { text } = data as { text?: unknown };
      if (!isString(text)) return null;
      return { k: 'def', text };
    }
    case 'vote': {
      const { idx } = data as { idx?: unknown };
      if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 1) return null;
      return { k: 'vote', idx };
    }
    case 'valid':
      return { k: 'valid' };
    case 'state': {
      const { state } = data as { state?: unknown };
      if (!isState(state)) return null;
      return { k: 'state', state };
    }
    case 'union': {
      const { words } = data as { words?: unknown };
      if (!isStringArray(words)) return null;
      return { k: 'union', words };
    }
    default:
      // Un `k` inconnu est ignoré (§6.5).
      return null;
  }
}

export function isGuestMessage(message: Message): message is GuestMessage {
  return message.k === 'hello' || message.k === 'pick' || message.k === 'def' || message.k === 'vote' || message.k === 'valid';
}

export function isHostMessage(message: Message): message is HostMessage {
  return message.k === 'state' || message.k === 'union';
}

/**
 * L'action du réducteur correspondant à un message d'invité.
 *
 * `by` est le pseudo du joueur, connu de l'hôte grâce à la table
 * `peerId → pseudo` (§6.6).
 *
 * C'est ici que l'index passe de **1…N sur le fil** à **0-based dans l'état**
 * (décision 15, §13).
 */
export function guestAction(message: GuestMessage, by: string): Action | null {
  switch (message.k) {
    case 'hello':
      return { k: 'hello', name: message.name };
    case 'pick':
      return { k: 'pick', by, w: message.w, p: message.p, d: message.d };
    case 'def':
      return { k: 'def', by, text: message.text };
    case 'vote':
      return { k: 'vote', by, idx: message.idx - 1 };
    case 'valid':
      return { k: 'valid', by };
  }
}

/**
 * Le message correspondant à une action locale d'un invité. Les actions
 * réservées à l'hôte (`start`, `reveal`…) n'ont pas de message : elles
 * n'existent que chez lui (§6.5).
 */
export function guestMessage(action: Action, hist: readonly string[] = []): GuestMessage | null {
  switch (action.k) {
    case 'hello':
      return { k: 'hello', name: action.name, hist: [...hist] };
    case 'pick':
      return { k: 'pick', w: action.w, p: action.p, d: action.d };
    case 'def':
      return { k: 'def', text: action.text };
    case 'vote':
      return { k: 'vote', idx: action.idx + 1 };
    case 'valid':
      return { k: 'valid' };
    default:
      return null;
  }
}
