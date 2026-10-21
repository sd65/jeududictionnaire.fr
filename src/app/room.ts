/**
 * L'ouverture d'une salle : le code, le transport, la session.
 *
 * C'est ici que l'application touche au réseau pour la première fois. Le
 * reste de l'application ne connaît que la session (§6.6).
 */

import { roomFromUrl, roomToUrl } from '../game/room';
import { createSession, type Session } from '../net/session';
import { createTrysteroTransport } from '../net/trystero';
import { readHistory, readHost, writeHistory, writeHost, writeRoom } from '../store/storage';

export type OpenRoom = {
  /** La session : l'état, le transport, les actions. */
  session: Session;
  /** Le code de la salle. */
  code: string;
  /** Vient-on de reprendre une partie en cours ? */
  restored: boolean;
};

/**
 * Le code de salle dans l'URL, s'il y en a un (`?room=ABCD`).
 *
 * Le plan n'a pas de routeur : le lien de la salle est la seule façon d'y
 * entrer (§6.6).
 */
export function roomInUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return roomFromUrl(window.location.search);
}

/**
 * Le code de la salle passe dans l'URL.
 *
 * C'est ce qui permet à un rechargement de retrouver la salle (§4.9,
 * §4.11) : l'URL est la seule chose qui survive à un rechargement.
 */
export function rememberRoomInUrl(code: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.history.replaceState(null, '', roomToUrl(code));
  } catch {
    // L'URL ne bougera pas : la salle reste ouverte, c'est tout.
  }
}

/**
 * L'URL revient à la racine : on a quitté la salle.
 *
 * Le code de salle dans l'URL, c'est ce qui fait revenir à la partie au
 * rechargement (§4.9). Puisqu'on quitte, on l'enlève — sinon un
 * rechargement renverrait l'appareil dans la partie qu'on vient de quitter.
 */
export function forgetRoomInUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    window.history.replaceState(null, '', '/');
  } catch {
    // L'URL ne bougera pas : tant pis.
  }
}

/**
 * L'hôte ouvre une salle.
 *
 * Si une partie est sauvegardée sur cet appareil et qu'elle appartient à ce
 * pseudo, elle est reprise : le joueur retrouve la table, les scores et la
 * manche en cours (§4.14).
 */
export function openHostRoom(code: string, name: string): OpenRoom {
  const session = createSession({
    transport: createTrysteroTransport(),
    room: code,
    name,
    role: 'host',
    // Les mots joués sur cet appareil (§4.4).
    hist: readHistory(),
    onHistory: (hist) => writeHistory(hist),
    // L'hôte sauvegarde son état après chaque action (§6.6).
    onState: (state) => writeHost(state, code),
  });

  const stored = readHost();
  const restorable =
    stored !== null && stored.state.seats.length > 0 && stored.state.seats[0] === name;
  if (restorable && stored) {
    session.store.set(stored.state);
  }

  rememberRoomInUrl(code);
  session.start();
  return { session, code, restored: restorable };
}

/** Un invité ouvre une salle. */
export function openGuestRoom(code: string, name: string): OpenRoom {
  const session = createSession({
    transport: createTrysteroTransport(),
    room: code,
    name,
    role: 'guest',
    // Les mots joués sur cet appareil (§4.4).
    hist: readHistory(),
    onHistory: (hist) => writeHistory(hist),
    // L'invité se souvient de la dernière salle entendue (§6.4).
    onState: () => writeRoom(code),
  });

  rememberRoomInUrl(code);
  session.start();
  return { session, code, restored: false };
}
