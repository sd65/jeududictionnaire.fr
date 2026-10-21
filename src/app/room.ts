/**
 * L'ouverture d'une salle : le code, le transport, la session.
 *
 * C'est ici que l'application touche au réseau pour la première fois. Le
 * reste de l'application ne connaît que la session (§6.6).
 */

import { roomFromUrl } from '../game/room';
import { createSession, type Session } from '../net/session';
import { createTrysteroTransport } from '../net/trystero';
import { readHost, writeHost, writeRoom } from '../store/storage';

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
    // L'hôte sauvegarde son état après chaque action (§6.6).
    onState: (state) => writeHost(state, code),
  });

  const stored = readHost();
  const restorable =
    stored !== null && stored.state.seats.length > 0 && stored.state.seats[0] === name;
  if (restorable && stored) {
    session.store.set(stored.state);
  }

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
    // L'invité se souvient de la dernière salle entendue (§6.4).
    onState: () => writeRoom(code),
  });

  session.start();
  return { session, code, restored: false };
}
