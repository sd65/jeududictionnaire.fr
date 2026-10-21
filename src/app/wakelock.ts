import { useEffect } from 'react';

/**
 * L'écran qui ne s'éteint pas (§4.13).
 *
 * La demande n'a de sens que dans un **contexte sécurisé** — donc pas sur un
 * simple `http://<ip-du-LAN>`, qui est le cas d'usage prévu (§6.8). C'est
 * donc une demande « au mieux » : elle ne doit jamais faire échouer
 * l'application, ni bruiter la console.
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
 * Demande l'éveil de l'écran, et le rend à la fin.
 *
 * La demande est faite sur **chaque** appareil, pas seulement chez l'hôte
 * (§4.13).
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let lock: WakeLock | null = null;
    let cancelled = false;

    void requestWakeLock().then((granted) => {
      if (cancelled) {
        void granted?.release();
        return;
      }
      lock = granted;
    });

    return () => {
      cancelled = true;
      void lock?.release();
    };
  }, [active]);
}
