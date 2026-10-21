/**
 * Un client Chrome DevTools Protocol minimal, sans dépendance.
 *
 * Node a un WebSocket dans sa bibliothèque standard : pas besoin de
 * Playwright, ni de Puppeteer, ni d'un paquet à installer (PLAN.md §12.11).
 */

import { setTimeout as sleep } from 'node:timers/promises';

/** Ouvre une session CDP sur une URL de WebSocket. */
export async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error(`Connexion CDP impossible : ${wsUrl}`));
  });

  let nextId = 0;
  const pending = new Map();
  const listeners = [];

  ws.onmessage = (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message.id !== undefined && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(`${message.error.message} (${message.method ?? ''})`));
      else resolve(message.result);
      return;
    }
    for (const listener of [...listeners]) listener(message);
  };

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = (nextId += 1);
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });

  return {
    send,
    /** S'abonne aux événements (méthode, params). */
    on(listener) {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      };
    },
    close() {
      ws.close();
    },
  };
}

/** Attend que `test` devienne vrai, en l'interrogeant à intervalles réguliers. */
export async function waitUntil(test, { timeout = 15000, step = 100, label = 'condition' } = {}) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    last = await test();
    if (last) return last;
    await sleep(step);
  }
  throw new Error(`Délai dépassé : ${label}`);
}
