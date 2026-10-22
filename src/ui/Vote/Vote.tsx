import { Ballot, DictationCard } from '../Ballot/Ballot';
import { LABELS } from '../text';
import type { ScreenProps } from '../types';
import { Voters } from './Voters';

/**
 * Le vote (§3 VOTE).
 *
 * Le bulletin est ouvert. La carte de dictation reste sur l'écran du
 * Chooser, jusqu'à la révélation : il peut faire répéter une définition.
 * Il y voit aussi **qui a voté** — et qui attend encore (§3 VOTE).
 */
export function Vote({ view, dispatch, me }: ScreenProps) {
  if (view.isChooser) {
    return (
      <section className="screen screen--vote">
        <h2>{LABELS.voteTitle}</h2>
        <DictationCard view={view} />
        <Voters view={view} />
      </section>
    );
  }

  return (
    <section className="screen screen--vote">
      <h2>{LABELS.voteTitle}</h2>
      <Ballot view={view} dispatch={dispatch} me={me} />
    </section>
  );
}
