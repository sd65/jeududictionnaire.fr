import { describe, expect, it } from 'vitest';
import { requestWakeLock, type WakeLock } from './wakelock';

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
