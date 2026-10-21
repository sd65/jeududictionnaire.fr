import { Lobby } from './Lobby/Lobby';
import { Pick } from './Pick/Pick';
import { Draft } from './Draft/Draft';
import { Dictate } from './Dictate/Dictate';
import { Vote } from './Vote/Vote';
import { Reveal } from './Reveal/Reveal';
import { End } from './End/End';
import { absenceReason } from '../game/project';
import { LABELS, MESSAGES } from './text';
import type { ScreenProps } from './types';

/**
 * L'écran se choisit sur la phase du jeu — et sur rien d'autre (§4.2, §6.6).
 *
 * Chaque écran ne dessine que ce que sa projection lui donne : c'est la
 * projection qui décide de ce qui est visible (§4.2).
 */
export function Screen(props: ScreenProps) {
  const absence = absenceReason(props.view);

  return (
    <>
      {absence === 'late' ? <p className="muted">{MESSAGES.gameInProgress}</p> : null}
      {absence === 'waiting' ? <p className="muted">{LABELS.waitingHost}</p> : null}
      {screenOf(props)}
      {absence !== 'none' && props.onHome ? (
        <button type="button" className="btn" onClick={props.onHome}>
          {LABELS.backHome}
        </button>
      ) : null}
    </>
  );
}

function screenOf(props: ScreenProps) {
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
