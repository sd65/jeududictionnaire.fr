/**
 * Le vrai transport : Trystero au-dessus de Nostr.
 *
 * Aucun serveur de jeu : les appareils se trouvent par un relais public et se
 * parlent en pair à pair (§6.1). Le canal est unique (`g`) et tout est
 * diffusé : il n'y a pas d'envoi ciblé (§6.5).
 *
 * Le relais met du temps à répondre ; les messages envoyés avant que la
 * connexion soit là sont mis en file d'attente par la bibliothèque, et
 * l'invité redit bonjour à chaque arrivée de pair (§4.9) — l'application ne
 * dépend donc pas du moment exact où la salle devient prête.
 */

import { joinRoom, selfId, type MessageAction, type Room } from 'trystero';
import type { PeerId, Transport } from './transport';

/** L'identifiant de l'application dans le réseau de relais. */
const APP_ID = 'jeu-du-dictionnaire';

/** Le canal unique de la salle (§6.5). */
const CHANNEL = 'g';

type Action = MessageAction<string>;

/**
 * Le code de salle est transporté en minuscules : un topic de relais
 * n'accepte que des minuscules (§3 LOBBY).
 */
export function topicOf(code: string): string {
  return `jdd-${code.trim().toLowerCase()}`;
}

export function createTrysteroTransport(): Transport {
  let room: Room | null = null;
  let action: Action | null = null;

  return {
    selfId,

    join(code, handlers) {
      room = joinRoom(
        { appId: APP_ID },
        topicOf(code),
        {
          onJoinError: (details) => {
            handlers.onError?.(new Error(details.error));
          },
        },
      );

      action = room.makeAction<string>(CHANNEL);
      action.onMessage = (data, context) => {
        handlers.onMessage?.(data, context.peerId);
      };
      room.onPeerJoin = (peerId: PeerId) => handlers.onPeerJoin?.(peerId);
      room.onPeerLeave = (peerId: PeerId) => handlers.onPeerLeave?.(peerId);

      // Trystero n'expose plus d'événement « salle prête » : la salle existe
      // dès l'appel. Ce n'est pas un problème — l'invité redit bonjour à
      // chaque arrivée de pair, et l'hôte rediffuse l'état à chaque
      // changement.
      handlers.onJoin?.();
    },

    send(data) {
      if (!action) return;
      // L'envoi est asynchrone ; un échec ici signifie simplement que le
      // pair n'était pas joignable. §6.5 : un échec d'envoi est réessayé une
      // fois par l'appelant, puis « Connexion instable » est montré.
      void action.send(data as string).catch(() => {});
    },

    leave() {
      void room?.leave();
      room = null;
      action = null;
    },
  };
}
