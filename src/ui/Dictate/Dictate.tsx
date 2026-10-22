import { Ballot, DictationCard } from '../Ballot/Ballot';
import { LABELS } from '../text';
import type { ScreenProps } from '../types';
import { Voters } from '../Vote/Voters';

/**
 * La dictée (§3 DICTATE).
 *
 * Le Chooser lit les définitions à voix haute, dans l'ordre gelé. Les autres
 * n'écoutent qu'avec leurs oreilles — sauf quand les définitions ne sont pas
 * affichées, où ils peuvent déjà voter, sur les numéros seuls (§4.5).
 *
 * Dans ce cas, les votes arrivent **pendant** la dictée : le Chooser y voit
 * qui a déjà voté (§3 VOTE).
 */
export function Dictate({ view, dispatch, me }: ScreenProps) {
  if (view.isChooser) {
    return (
      <section className="screen screen--dictate">
        <h2>{LABELS.dictateTitle}</h2>
        <p className="muted">{LABELS.dictating}</p>
        <DictationCard view={view} />
        <Voters view={view} />
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            if (me === null) return;
            dispatch({ k: 'valid', by: me });
          }}
        >
          {LABELS.validate}
        </button>
      </section>
    );
  }

  if (!view.showDefinitions) {
    return (
      <section className="screen screen--dictate">
        <h2>{LABELS.dictateTitle}</h2>
        <Ballot view={view} dispatch={dispatch} me={me} />
      </section>
    );
  }

  return (
    <section className="screen screen--dictate">
      <h2>{LABELS.dictateTitle}</h2>
      <p className="muted">{LABELS.listening}</p>
    </section>
  );
}
