import { useEffect } from 'react';

/**
 * L'écran qui ne s'éteint pas (§4.13).
 *
 * La demande n'a de sens que dans un **contexte sécurisé** — donc pas sur un
 * simple `http://<ip-du-LAN>` (§6.8). C'est donc une demande « au mieux » :
 * elle ne doit jamais faire échouer l'application, ni bruiter la console.
 *
 * Sur le site déployé, le contexte est sécurisé (HTTPS, §6.1) : le verrou est
 * pris, et **repris** quand la page revient au premier plan.
 */

export type WakeLock = {
  release: () => Promise<void>;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLock> };
};

/** La demande, seule. Elle ne jette jamais. */
export async function requestWakeLock(): Promise<WakeLock | null> {
  const nav = globalThis.navigator as NavigatorWithWakeLock | undefined;
  if (!nav || !nav.wakeLock) return null;
  try {
    return await nav.wakeLock.request('screen');
  } catch {
    // Refusé, ou pas de contexte sécurisé : on continue sans.
    return null;
  }
}

/**
 * Ce dont le verrou a besoin — abstrait pour être testé sans navigateur.
 */
export type WakeLockEnvironment = {
  /** La demande de verrou. */
  request: () => Promise<WakeLock | null>;
  /** La page est-elle au premier plan ? */
  isVisible: () => boolean;
  /** S'abonner aux changements de visibilité ; renvoie le désabonnement. */
  onVisibilityChange: (listener: () => void) => () => void;
};

/**
 * Demande l'éveil de l'écran, et le **reprend** quand la page revient.
 *
 * Le navigateur **rend** le verrou dès que l'onglet passe en arrière-plan :
 * sans cette reprise, l'écran se rendort après un aller-retour dans une autre
 * application — c'est-à-dire au moment où l'on jette un œil au téléphone pour
 * suivre la partie.
 *
 * Renvoie la fonction de fin, qui rend le verrou.
 */
export function keepScreenAwake(env: WakeLockEnvironment): () => void {
  let lock: WakeLock | null = null;
  let cancelled = false;

  const acquire = () => {
    void env.request().then((granted) => {
      if (cancelled) {
        // La demande a abouti après l'arrêt : on rend tout de suite.
        void granted?.release();
        return;
      }
      lock = granted;
    });
  };

  const unsubscribe = env.onVisibilityChange(() => {
    if (env.isVisible()) acquire();
  });

  acquire();

  return () => {
    cancelled = true;
    unsubscribe();
    void lock?.release();
  };
}

/**
 * Demande l'éveil de l'écran, et le rend à la fin.
 *
 * La demande est faite sur **chaque** appareil, pas seulement chez l'hôte
 * (§4.13).
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const stop = keepScreenAwake({
      request: requestWakeLock,
      isVisible: () => document.visibilityState === 'visible',
      onVisibilityChange: (listener) => {
        document.addEventListener('visibilitychange', listener);
        return () => document.removeEventListener('visibilitychange', listener);
      },
    });
    return stop;
  }, [active]);
}
