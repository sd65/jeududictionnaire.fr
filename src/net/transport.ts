/**
 * Le transport : une petite interface, deux implémentations.
 *
 * - `createMemoryTransport()` : tout se passe dans le même processus, ce qui
 *   permet de jouer une partie entière dans un fichier de test (§6.7) ;
 * - `src/net/trystero.ts` : le vrai transport P2P, derrière la même interface.
 *
 * Le transport ne sait rien du jeu : il transporte des messages et annonce
 * les arrivées et les départs. Tout le reste — ce qu'est un message, ce
 * qu'on en fait — est dans `protocol.ts` et `session.ts`.
 */

export type PeerId = string;

export type TransportHandlers = {
  /** Un message est arrivé de ce pair. */
  onMessage?: (data: unknown, from: PeerId) => void;
  /** Un pair est arrivé dans la salle. */
  onPeerJoin?: (peerId: PeerId) => void;
  /** Un pair est parti. */
  onPeerLeave?: (peerId: PeerId) => void;
  /** La salle est prête (les relais ont répondu). */
  onJoin?: () => void;
  /** La salle n'a pas pu être rejointe. */
  onError?: (error: Error) => void;
};

export type Transport = {
  /**
   * L'identifiant de cet appareil. Il est **régénéré à chaque chargement** :
   * l'identité du joueur, c'est son pseudo, jamais cet identifiant (§4.9).
   */
  readonly selfId: PeerId;
  /** Rejoint une salle. */
  join(room: string, handlers: TransportHandlers): void;
  /** Envoie un message à toute la salle. */
  send(data: unknown): void;
  /** Quitte la salle. */
  leave(): void;
};

/* ------------------------------------------------------------------------ */
/* L'implémentation en mémoire                                                */
/* ------------------------------------------------------------------------ */

type MemoryPeer = {
  id: PeerId;
  handlers: TransportHandlers;
};

type MemoryRoom = {
  peers: Map<PeerId, MemoryPeer>;
};

const rooms = new Map<string, MemoryRoom>();
let peerCounter = 0;

/**
 * Les livraisons en attente. Le réseau est asynchrone : un message n'est
 * jamais reçu pendant l'envoi. Les tests avancent le temps avec `flush()`.
 */
let pending: (() => void)[] = [];

/** Vide la file des livraisons, y compris celles que l'une d'elles engendre. */
export function flush(): void {
  let guard = 0;
  while (pending.length > 0 && guard < 1000) {
    const current = pending;
    pending = [];
    for (const deliver of current) deliver();
    guard += 1;
  }
}

function roomOf(code: string): MemoryRoom {
  let room = rooms.get(code);
  if (!room) {
    room = { peers: new Map() };
    rooms.set(code, room);
  }
  return room;
}

/**
 * Un transport qui ne quitte pas le processus. Les salons sont partagés par
 * code : deux transports qui rejoignent le même code se voient.
 */
export function createMemoryTransport(selfId?: PeerId): Transport {
  const id = selfId ?? `mem-${(peerCounter += 1)}`;
  let current: { code: string; room: MemoryRoom } | null = null;
  let handlers: TransportHandlers = {};

  return {
    selfId: id,

    join(code, nextHandlers) {
      handlers = nextHandlers;
      const room = roomOf(code);
      current = { code, room };
      pending.push(() => {
        // Les pairs déjà là sont annoncés comme entrés, puis l'arrivée de
        // ce pair est annoncée aux autres — comme le fait Trystero.
        for (const other of room.peers.values()) {
          if (other.id !== id) handlers.onPeerJoin?.(other.id);
        }
        room.peers.set(id, { id, handlers });
        handlers.onJoin?.();
        for (const other of room.peers.values()) {
          if (other.id !== id) other.handlers.onPeerJoin?.(id);
        }
      });
    },

    send(data) {
      if (!current) return;
      const { room } = current;
      // Une copie : le message passe par le « réseau », il n'est pas partagé.
      const payload = JSON.parse(JSON.stringify(data)) as unknown;
      pending.push(() => {
        for (const other of room.peers.values()) {
          if (other.id === id) continue; // on ne se renvoie pas son propre message
          other.handlers.onMessage?.(payload, id);
        }
      });
    },

    leave() {
      if (!current) return;
      const { code, room } = current;
      current = null;
      pending.push(() => {
        room.peers.delete(id);
        for (const other of room.peers.values()) other.handlers.onPeerLeave?.(id);
        if (room.peers.size === 0) rooms.delete(code);
      });
    },
  };
}
