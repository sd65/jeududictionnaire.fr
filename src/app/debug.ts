import { useEffect } from 'react';
import type { View } from '../game/project';

/**
 * Le crochet de débogage (§6.6).
 *
 * L'application expose sa projection courante dans `window.__jdd`. C'est ce
 * que le harnais end-to-end lit pour savoir dans quelle phase un joueur se
 * trouve, plutôt que de gratter le DOM (§12.11).
 *
 * Il est **en lecture seule** : il n'y a aucun sens de jeu derrière, et
 * rien ne le modifie en dehors de l'application.
 */
export function useDebugHook(view: View): void {
  useEffect(() => {
    window.__jdd = view;
  }, [view]);
}
