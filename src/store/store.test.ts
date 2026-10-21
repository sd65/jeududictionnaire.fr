import { describe, expect, it, vi } from 'vitest';
import { createStore } from './store';

describe('le store', () => {
  it('renvoie la valeur initiale', () => {
    const store = createStore({ phase: 'LOBBY' });
    expect(store.getSnapshot()).toEqual({ phase: 'LOBBY' });
  });

  it('previens les abonnés une fois par changement', () => {
    const store = createStore({ phase: 'LOBBY' });
    const listener = vi.fn();
    store.subscribe(listener);

    store.set({ phase: 'PICK' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toEqual({ phase: 'PICK' });
  });

  it('ne prévient pas quand la valeur est la même référence', () => {
    const initial = { phase: 'LOBBY' };
    const store = createStore(initial);
    const listener = vi.fn();
    store.subscribe(listener);

    store.set(initial);

    expect(listener).not.toHaveBeenCalled();
  });

  it('prévient quand la valeur est un nouvel objet', () => {
    const store = createStore({ phase: 'LOBBY' });
    const listener = vi.fn();
    store.subscribe(listener);

    store.set({ phase: 'LOBBY' });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('laisse se désabonner', () => {
    const store = createStore({ phase: 'LOBBY' });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.set({ phase: 'PICK' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('ne se dérègle pas si un abonné se désabonne pendant la notification', () => {
    const store = createStore(0);
    const second = vi.fn();
    const unsubscribeSecond = store.subscribe(() => unsubscribeSecond());
    store.subscribe(second);

    store.set(1);

    expect(second).toHaveBeenCalledTimes(1);
  });
});
