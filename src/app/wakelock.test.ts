import { describe, expect, it } from 'vitest';
import { keepScreenAwake, requestWakeLock, type WakeLock } from './wakelock';

const scope = globalThis as { navigator?: unknown };

describe('la demande d’éveil de l’écran', () => {
  it('ne jette jamais, sans navigateur', async () => {
    const real = scope.navigator;
    delete scope.navigator;
    try {
      await expect(requestWakeLock()).resolves.toBeNull();
    } finally {
      scope.navigator = real;
    }
  });

  it('ne jette jamais, quand le navigateur n’a pas de réveil d’écran', async () => {
    const real = scope.navigator;
    scope.navigator = {};
    try {
      await expect(requestWakeLock()).resolves.toBeNull();
    } finally {
      scope.navigator = real;
    }
  });

  it('ne jette jamais, quand la demande est refusée', async () => {
    const real = scope.navigator;
    scope.navigator = {
      wakeLock: {
        request: () => Promise.reject(new Error('contexte non sécurisé')),
      },
    };
    try {
      await expect(requestWakeLock()).resolves.toBeNull();
    } finally {
      scope.navigator = real;
    }
  });

  it('rend l’éveil quand la demande passe', async () => {
    const real = scope.navigator;
    const lock: WakeLock = { release: () => Promise.resolve() };
    let asked = '';
    scope.navigator = {
      wakeLock: {
        request: (type: 'screen') => {
          asked = type;
          return Promise.resolve(lock);
        },
      },
    };
    try {
      await expect(requestWakeLock()).resolves.toBe(lock);
      expect(asked).toBe('screen');
    } finally {
      scope.navigator = real;
    }
  });
});

/** Un environnement de test : la page, et les demandes de verrou. */
function fakePage() {
  const locks: WakeLock[] = [];
  const released: number[] = [];
  const listeners: (() => void)[] = [];
  let visible = true;

  return {
    locks,
    released,
    /** La page passe en arrière-plan, puis revient. */
    setVisible(next: boolean) {
      visible = next;
      if (!visible) {
        // Le navigateur rend le verrou quand l'onglet passe en arrière-plan.
        for (const lock of locks) void lock.release();
      }
      for (const listener of listeners) listener();
    },
    env: {
      request: async () => {
        const index = locks.length;
        const lock: WakeLock = {
          release: () => {
            released.push(index);
            return Promise.resolve();
          },
        };
        locks.push(lock);
        return lock;
      },
      isVisible: () => visible,
      onVisibilityChange: (listener: () => void) => {
        listeners.push(listener);
        return () => {
          const index = listeners.indexOf(listener);
          if (index >= 0) listeners.splice(index, 1);
        };
      },
    },
  };
}

describe('le verrou d’éveil', () => {
  it('demande le verrou, et le rend à la fin', async () => {
    const page = fakePage();
    const stop = keepScreenAwake(page.env);
    await Promise.resolve();

    expect(page.locks).toHaveLength(1);
    expect(page.released).toEqual([]);

    stop();
    await Promise.resolve();
    expect(page.released).toEqual([0]);
  });

  it('reprend le verrou quand la page redevient visible', async () => {
    const page = fakePage();
    const stop = keepScreenAwake(page.env);
    await Promise.resolve();

    // L'onglet passe en arrière-plan : le navigateur rend le verrou.
    page.setVisible(false);
    await Promise.resolve();
    expect(page.locks).toHaveLength(1);
    expect(page.released).toEqual([0]);

    // La page revient : le verrou est redemandé.
    page.setVisible(true);
    await Promise.resolve();
    expect(page.locks).toHaveLength(2);

    stop();
    await Promise.resolve();
    expect(page.released).toEqual([0, 1]);
  });

  it('ne redemande rien tant que la page est en arrière-plan', async () => {
    const page = fakePage();
    const stop = keepScreenAwake(page.env);
    await Promise.resolve();

    page.setVisible(false);
    page.setVisible(false);
    await Promise.resolve();
    expect(page.locks).toHaveLength(1);

    stop();
  });

  it('ne demande rien si la demande échoue', async () => {
    const stop = keepScreenAwake({
      request: () => Promise.resolve(null),
      isVisible: () => true,
      onVisibilityChange: () => () => {},
    });
    await Promise.resolve();
    // Rien à rendre, et surtout : aucune exception.
    expect(() => stop()).not.toThrow();
  });
});
