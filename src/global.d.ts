import type { View } from './game/project';

declare global {
  interface Window {
    /**
     * Le crochet de débogage (§6.6) : la projection courante, en lecture
     * seule. C'est ce que le harnais end-to-end lit pour savoir dans quelle
     * phase un joueur se trouve (§12.11).
     */
    __jdd?: View;
  }
}

export {};
