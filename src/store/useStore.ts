import { useSyncExternalStore } from 'react';
import type { Store } from './store';

/**
 * Lit un store externe dans un composant (§6.6).
 *
 * `subscribe` et `getSnapshot` doivent être stables : les deux fonctions du
 * store le sont (ce sont des propriétés de l'objet, pas des closures
 * recréées à chaque rendu).
 */
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
