import { Lobby } from './Lobby/Lobby';
import { Pick } from './Pick/Pick';
import { Draft } from './Draft/Draft';
import { Dictate } from './Dictate/Dictate';
import { Vote } from './Vote/Vote';
import { Reveal } from './Reveal/Reveal';
import { End } from './End/End';
import type { ScreenProps } from './types';

/**
 * L'écran se choisit sur la phase du jeu — et sur rien d'autre (§4.2, §6.6).
 *
 * Ces écrans sont des coquilles : leur contenu définitif arrive en phase D
 * (PLAN.md §12.8). Ils dessinent déjà ce que la projection leur donne, et
 * rien de plus.
 */
export function Screen(props: ScreenProps) {
  switch (props.view.phase) {
    case 'LOBBY':
      return <Lobby {...props} />;
    case 'PICK':
      return <Pick {...props} />;
    case 'DRAFT':
      return <Draft {...props} />;
    case 'DICTATE':
      return <Dictate {...props} />;
    case 'VOTE':
      return <Vote {...props} />;
    case 'REVEAL':
      return <Reveal {...props} />;
    case 'END':
      return <End {...props} />;
  }
}
