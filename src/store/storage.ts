/**
 * Le stockage local de l'appareil (§6.4).
 *
 * Cinq clés, et rien d'autre :
 *
 * | Clé       | Contenu                                        |
 * |-----------|------------------------------------------------|
 * | `jdd.hist`| les mots joués sur cet appareil                |
 * | `jdd.name`| le pseudo par défaut                           |
 * | `jdd.host`| la sauvegarde de l'état de l'hôte               |
 * | `jdd.draft`| le texte non envoyé                            |
 * | `jdd.room`| la dernière salle reçue                        |
 *
 * Le stockage peut être absent (navigation privée, vieux navigateur) : toutes
 * les lectures renvoient alors une valeur neutre, et toutes les écritures
 * sont ignorées. Le jeu n'en dépend pas.
 */

import type { State } from '../game/state';

export type HostSnapshot = {
  /** L'état de la partie, tel que l'hôte l'a réduit. */
  state: State;
  /** Le code de la salle : c'est lui qu'on reprend (§4.14). */
  code: string;
  /** La dernière action appliquée, en millisecondes. */
  at: number;
};

export type RoomSnapshot = {
  /** Le code de la salle. */
  code: string;
  /** La dernière fois que l'appareil a reçu un état de cette salle. */
  seenAt: number;
};

/** Une heure : au-delà, une salle stockée est abandonnée (§4.14). */
export const ROOM_TTL = 60 * 60 * 1000;

const KEYS = {
  hist: 'jdd.hist',
  name: 'jdd.name',
  host: 'jdd.host',
  draft: 'jdd.draft',
  room: 'jdd.room',
} as const;

export const STORAGE_KEYS = KEYS;

/**
 * Le stockage local, s'il y en a un.
 *
 * Il n'existe que dans un navigateur : sous Node, il n'y en a pas, et
 * le jeu tourne sans (§6.7).
 */
function store(): Storage | null {
  if (typeof globalThis.window === 'undefined') return null;
  try {
    return globalThis.window.localStorage;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ jdd.name */

/** Le pseudo par défaut de cet appareil. */
export function readName(): string {
  return store()?.getItem(KEYS.name) ?? '';
}

export function writeName(name: string): void {
  store()?.setItem(KEYS.name, name);
}

/* ----------------------------------------------------------------- jdd.host */

/** La sauvegarde de l'hôte : l'état de la partie, et son dernier souffle. */
export function readHost(): HostSnapshot | null {
  const raw = store()?.getItem(KEYS.host);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<HostSnapshot>;
    if (typeof parsed?.at !== 'number') return null;
    if (typeof parsed.code !== 'string' || parsed.code === '') return null;
    if (!parsed.state || typeof parsed.state.phase !== 'string') return null;
    return { state: parsed.state as State, code: parsed.code, at: parsed.at };
  } catch {
    return null;
  }
}

export function writeHost(state: State, code: string, at: number = Date.now()): void {
  store()?.setItem(KEYS.host, JSON.stringify({ state, code, at }));
}

export function clearHost(): void {
  store()?.removeItem(KEYS.host);
}

/* ----------------------------------------------------------------- jdd.room */

/** La dernière salle que cet appareil a entendue (§4.14). */
export function readRoom(): RoomSnapshot | null {
  const raw = store()?.getItem(KEYS.room);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RoomSnapshot>;
    if (typeof parsed?.seenAt !== 'number') return null;
    if (typeof parsed.code !== 'string' || parsed.code === '') return null;
    return { code: parsed.code, seenAt: parsed.seenAt };
  } catch {
    return null;
  }
}

export function writeRoom(code: string, seenAt: number = Date.now()): void {
  store()?.setItem(KEYS.room, JSON.stringify({ code, seenAt }));
}

export function clearRoom(): void {
  store()?.removeItem(KEYS.room);
}

/* ----------------------------------------------------------------- jdd.hist */

/** Le plafond de l'historique local, en FIFO (§6.4). */
export const HISTORY_CAP = 3000;

/** Les mots joués sur cet appareil. */
export function readHistory(): string[] {
  const raw = store()?.getItem(KEYS.hist);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((word): word is string => typeof word === 'string');
  } catch {
    return [];
  }
}

export function writeHistory(words: readonly string[]): void {
  store()?.setItem(KEYS.hist, JSON.stringify(words.slice(-HISTORY_CAP)));
}

/** « Effacer mon historique de mots » : cet appareil seul (§4.4). */
export function clearHistory(): void {
  store()?.removeItem(KEYS.hist);
}

/* ---------------------------------------------------------------- jdd.draft */

/** Le texte non envoyé est rangé par salle (§6.4). */
function draftKey(room: string): string {
  return `${KEYS.draft}.${room}`;
}

/** Le texte tapé mais pas encore envoyé, pour cette salle. */
export function readDraft(room: string): string {
  return store()?.getItem(draftKey(room)) ?? '';
}

export function writeDraft(room: string, text: string): void {
  const key = draftKey(room);
  if (text) store()?.setItem(key, text);
  else store()?.removeItem(key);
}

/* ------------------------------------------------------------------ commun */

/**
 * La partie sauvegardée, si elle est bien celle de cette salle.
 *
 * Quatre conditions : **la salle**, le pseudo de l'hôte, l'heure, et le
 * fait qu'il y ait des joueurs.
 *
 * La salle d'abord, et c'est essential : une salle **neuve** ne doit surtout
 * pas hériter de la partie précédente — sinon son classement apparaît dans
 * une partie où personne n'a jamais joué (§4.11, §4.14).
 */
export function savedGameFor(
  stored: HostSnapshot | null,
  code: string,
  name: string,
): State | null {
  if (stored === null) return null;
  if (stored.code !== code) return null;
  if (!isFresh(stored.at)) return null;
  if (stored.state.seats.length === 0) return null;
  if (stored.state.seats[0] !== name) return null;
  return stored.state;
}

/**
 * Une salle stockée est-elle encore vivante ? (§4.14 : une heure)
 *
 * « Dernière activité » : la dernière action appliquée, changements de phase
 * compris.
 */
export function isFresh(at: number, now: number = Date.now()): boolean {
  return now - at < ROOM_TTL;
}
