import { describe, expect, it } from 'vitest';
import { createMemoryTransport, flush } from './transport';

/**
 * Un salon neuf pour chaque test : les salons sont globaux au module, et un
 * pair resté dans un salon avertirait le test suivant.
 */
let roomCounter = 0;
const newRoom = () => `SALLE${(roomCounter += 1)}`;

describe('le transport en mémoire', () => {
  it('laisse deux appareils s’échanger un message', () => {
    const code = newRoom();
    const alice = createMemoryTransport('alice');
    const bob = createMemoryTransport('bob');

    const received: { data: unknown; from: string }[] = [];
    bob.join(code, { onMessage: (data, from) => received.push({ data, from }) });
    alice.join(code, {});
    flush();

    alice.send({ k: 'hello' });
    flush();

    expect(received).toEqual([{ data: { k: 'hello' }, from: 'alice' }]);
  });

  it('ne renvoie jamais un message à son expéditeur', () => {
    const code = newRoom();
    const alice = createMemoryTransport('alice');
    const bob = createMemoryTransport('bob');

    const aliceGot: unknown[] = [];
    const bobGot: unknown[] = [];
    alice.join(code, { onMessage: (data) => aliceGot.push(data) });
    bob.join(code, { onMessage: (data) => bobGot.push(data) });
    flush();

    alice.send({ k: 'state' });
    flush();

    expect(aliceGot).toEqual([]);
    expect(bobGot).toEqual([{ k: 'state' }]);
  });

  it('annonce l’arrivée des pairs, dans les deux sens', () => {
    const code = newRoom();
    const alice = createMemoryTransport('alice');
    const bob = createMemoryTransport('bob');

    const aliceSaw: string[] = [];
    const bobSaw: string[] = [];
    alice.join(code, { onPeerJoin: (id) => aliceSaw.push(id) });
    flush();
    bob.join(code, { onPeerJoin: (id) => bobSaw.push(id) });
    flush();

    expect(aliceSaw).toEqual(['bob']);
    expect(bobSaw).toEqual(['alice']);
  });

  it('annonce les départs', () => {
    const code = newRoom();
    const alice = createMemoryTransport('alice');
    const bob = createMemoryTransport('bob');

    const left: string[] = [];
    alice.join(code, { onPeerLeave: (id) => left.push(id) });
    bob.join(code, {});
    flush();

    bob.leave();
    flush();

    expect(left).toEqual(['bob']);
  });

  it('isole deux salons différents', () => {
    const alice = createMemoryTransport('alice');
    const zoe = createMemoryTransport('zoe');

    const received: unknown[] = [];
    zoe.join(newRoom(), { onMessage: (data) => received.push(data) });
    alice.join(newRoom(), {});
    flush();

    alice.send({ k: 'hello' });
    flush();

    expect(received).toEqual([]);
  });

  it('n’envoie rien si l’on n’a pas rejoint de salle', () => {
    const alice = createMemoryTransport('alice');
    expect(() => alice.send({ k: 'hello' })).not.toThrow();
    flush();
  });

  it('copie le message : l’émetteur et le récepteur ne partagent pas l’objet', () => {
    const code = newRoom();
    const alice = createMemoryTransport('alice');
    const bob = createMemoryTransport('bob');

    const received: { data: unknown }[] = [];
    bob.join(code, { onMessage: (data) => received.push({ data }) });
    alice.join(code, {});
    flush();

    const payload = { k: 'union', words: ['a'] };
    alice.send(payload);
    flush();

    payload.words.push('b');
    expect(received[0]?.data).toEqual({ k: 'union', words: ['a'] });
  });
});
