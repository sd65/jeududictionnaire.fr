/**
 * La session : ce que fait un appareil dans une salle.
 *
 * - **l'hôte** est le seul à réduire (§6.6). Il applique les actions, les
 *   invitations et les départs, puis diffuse l'état entier ;
 * - **l'invité** envoie des intentions et dessine le dernier état reçu.
 *
 * Un point important : l'union des historiques (§4.4) **n'est pas** dans
 * l'état — l'état a exactement les champs du §6.6. Elle vit ici, en mémoire,
 * et l'hôte la diffuse à chaque arrivée de siège.
 */

import { reduce, type Action } from '../game/reduce';
import { type View, project } from '../game/project';
import { initialState, samePseudo, type Author, type State } from '../game/state';
import { excludedSet, normalize } from '../game/words';
import { createStore, type Store } from '../store/store';
import { decode, encode, guestAction, guestMessage, isHostMessage } from './protocol';
import type { PeerId, Transport } from './transport';

export type SessionRole = 'host' | 'guest';

export type SessionOptions = {
  transport: Transport;
  /** Le code de la salle, 4 lettres. */
  room: string;
  /** Le pseudo de cet appareil : c'est l'identité du joueur (§4.9). */
  name: string;
  role: SessionRole;
  /** Les mots joués sur cet appareil. */
  hist?: string[] | undefined;
  /** L'union déjà connue (l'hôte la recharge après un rechargement). */
  union?: string[] | undefined;
  /** Le mélange qui fige l'ordre du bulletin — injectable pour les tests. */
  shuffle?: ((items: readonly Author[]) => Author[]) | undefined;
  /** Appelé quand l'historique local change. */
  onHistory?: ((hist: string[]) => void) | undefined;
  /** Appelé après chaque action appliquée (l'hôte le persiste). */
  onState?: ((state: State) => void) | undefined;
  /** Appelé quand l'union change. */
  onUnion?: ((words: string[]) => void) | undefined;
};

export type Session = {
  readonly role: SessionRole;
  readonly name: string;
  readonly store: Store<State>;
  /** La projection pour cet appareil (§4.2). */
  view(): View;
  /** Les mots exclus : l'historique local ∪ l'union (§4.4). */
  excluded(): ReadonlySet<string>;
  /** L'union connue de cet appareil. */
  union(): string[];
  /** L'historique local de cet appareil. */
  history(): string[];
  /** Applique une action : l'hôte la réduit, l'invité l'envoie. */
  dispatch(action: Action): void;
  /** Rejoint la salle. */
  start(): void;
  /** Quitte la salle. */
  leave(): void;
};

/** Le plafond de l'historique local, en FIFO (§6.4). */
const HIST_CAP = 3000;

/** La marque du pair qui est l'hôte, pour un invité. */
const HOST_PEER = 'hôte';

export function createSession(options: SessionOptions): Session {
  const { transport, room, name, role } = options;
  const store = createStore<State>(initialState());
  const shuffle = options.shuffle;

  let hist: string[] = [...(options.hist ?? [])];
  // Chez l'hôte, l'union inclut son propre historique : l'hôte est un
  // appareil assis comme les autres (§4.4). Chez l'invité, l'union reçue
  // remplace celle-ci ; son historique local reste de côté.
  let union = new Set<string>(
    (role === 'host' ? [...(options.union ?? []), ...hist] : (options.union ?? [])).map(normalize),
  );
  /** `peerId → pseudo` : chez l'hôte, les sièges ; chez l'invité, l'hôte. */
  const peers = new Map<string, string>();

  const excluded = () => excludedSet(hist, [...union]);

  /** Le mot de la manche en cours rejoint l'historique local (§4.4). */
  const rememberWord = (state: State) => {
    if (state.phase !== 'DRAFT' || !state.word) return;
    if (hist.includes(state.word)) return;
    hist.push(state.word);
    if (hist.length > HIST_CAP) hist = hist.slice(-HIST_CAP);
    options.onHistory?.([...hist]);
  };

  const broadcastState = (state: State) => {
    transport.send(encode({ k: 'state', state }));
  };

  const broadcastUnion = () => {
    transport.send(encode({ k: 'union', words: [...union] }));
  };

  /** Applique une action chez l'hôte, puis diffuse le nouvel état. */
  const applyAndBroadcast = (action: Action) => {
    const before = store.getSnapshot();
    const after = reduce(before, action, { excluded: excluded(), shuffle });
    if (after === before) return;
    store.set(after);
    options.onState?.(after);
    rememberWord(after);
    broadcastState(after);
  };

  const sendHello = () => {
    transport.send(encode({ k: 'hello', name, hist }));
  };

  const handleMessage = (raw: unknown, from: PeerId) => {
    const message = decode(raw);
    if (!message) return;

    if (role === 'guest') {
      if (message.k === 'state') {
        // C'est l'hôte qui diffuse l'état : son pair est donc l'hôte.
        peers.set(from, HOST_PEER);
        store.set(message.state);
        options.onState?.(message.state);
        rememberWord(message.state);
      } else if (message.k === 'union') {
        union = new Set(message.words.map(normalize));
        options.onUnion?.([...union]);
      }
      return;
    }

    // L'hôte ignore les messages qui sont les siens.
    if (isHostMessage(message)) return;

    if (message.k === 'hello') {
      const before = store.getSnapshot();
      const after = reduce(before, { k: 'hello', name: message.name }, {
        excluded: excluded(),
        shuffle,
      });
      const seat = after.seats.find((s) => samePseudo(s, message.name));
      const seated = seat !== undefined && after.connected[seat] === true;
      const wasSeated = seat !== undefined && before.connected[seat] === true;

      if (seated && !wasSeated) {
        // Un siège vient d'être pris ou repris : on associe le pair au
        // pseudo, on fusionne son historique, on diffuse l'union (§4.4).
        peers.set(from, seat!);
        for (const word of message.hist) union.add(normalize(word));
        options.onUnion?.([...union]);
        broadcastUnion();
      }

      if (after !== before) {
        store.set(after);
        options.onState?.(after);
        rememberWord(after);
        broadcastState(after);
      }
      return;
    }

    // Les autres messages d'invité : on ignore ceux d'un pair non assis.
    const by = peers.get(from);
    if (!by) return;
    const action = guestAction(message, by);
    if (!action) return;
    applyAndBroadcast(action);
  };

  const handlePeerJoin = () => {
    if (role !== 'guest') return;
    // Chaque invité redit bonjour à chaque arrivée : c'est ce qui permet à
    // l'hôte de se reconnecter avec un nouvel identifiant (§4.9).
    sendHello();
  };

  const handlePeerLeave = (peerId: PeerId) => {
    if (role === 'host') {
      const pseudo = peers.get(peerId);
      if (!pseudo) return;
      peers.delete(peerId);
      applyAndBroadcast({ k: 'leave', by: pseudo });
      return;
    }
    // L'invité ne sait qu'une chose du départ d'un pair : si c'est l'hôte,
    // plus personne ne diffuse l'état. Il applique donc la déconnexion
    // localement, en attendant son retour (§4.11).
    if (peers.get(peerId) !== HOST_PEER) return;
    const state = store.getSnapshot();
    const hostPseudo = state.seats[0];
    if (!hostPseudo) return;
    const after = reduce(state, { k: 'leave', by: hostPseudo });
    if (after !== state) store.set(after);
  };

  return {
    role,
    name,
    store,

    view: () => project(store.getSnapshot(), name),
    excluded: () => excluded(),
    union: () => [...union],
    history: () => [...hist],

    dispatch(action) {
      if (role === 'host') {
        applyAndBroadcast(action);
        return;
      }
      const message = guestMessage(action, hist);
      if (!message) return; // une action réservée à l'hôte
      transport.send(encode(message));
    },

    start() {
      transport.join(room, {
        onMessage: handleMessage,
        onPeerJoin: handlePeerJoin,
        onPeerLeave: handlePeerLeave,
        onJoin: () => {
          if (role === 'host') {
            const state = store.getSnapshot();
            if (state.seats.length === 0) {
              // L'hôte est le premier siège.
              applyAndBroadcast({ k: 'hello', name });
            } else {
              // L'hôte revient après un rechargement : tous les autres sièges
              // sont déconnectés jusqu'à ce que leurs propriétaires disent
              // bonjour (§6.5).
              applyAndBroadcast({ k: 'hostBack', by: name });
            }
            return;
          }
          sendHello();
        },
      });
    },

    leave() {
      transport.leave();
    },
  };
}
