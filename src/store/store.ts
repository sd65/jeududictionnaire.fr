/**
 * Le store : une boîte d'état externe, en TypeScript tout simple.
 *
 * L'état du jeu n'est pas dans React : le réseau le met à jour directement,
 * hors du cycle de rendu, et les composants s'y abonnent avec
 * `useSyncExternalStore` (§6.6). Pas de contexte React pour l'état du jeu.
 */

export type Store<T> = {
  /** L'état courant. Toujours la même référence tant qu'il ne change pas. */
  getSnapshot(): T;
  /** Remplace l'état. Les abonnés ne sont prévenus que si la valeur change. */
  set(value: T): void;
  /** S'abonne ; renvoie la fonction de désabonnement. */
  subscribe(listener: () => void): () => void;
};

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => value,

    set(next) {
      // La même référence : rien n'a changé, personne n'est prévenu.
      if (Object.is(next, value)) return;
      value = next;
      // Une copie : un abonné qui se désabonne pendant la notification ne
      // doit pas fausser la tournée.
      for (const listener of [...listeners]) listener();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
