import type { Session } from '../net/session';
import { createStore } from '../store/store';
import { useStore } from '../store/useStore';

/**
 * La session courante : la salle que cet appareil a rejointe.
 *
 * Ce n'est pas l'état du jeu — l'état vit dans le store de la session
 * (§6.6). Ici, on ne garde que le *lien* vers la session, pour que l'écran
 * puisse s'y abonner.
 */
const sessionStore = createStore<Session | null>(null);

export function setSession(session: Session | null): void {
  sessionStore.set(session);
}

export function useSession(): Session | null {
  return useStore(sessionStore);
}
