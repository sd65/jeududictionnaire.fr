import { Ballot, DictationCard } from '../Ballot/Ballot';
import { LABELS } from '../text';
import type { ScreenProps } from '../types';

/**
 * La dictée (§3 DICTATE).
 *
 * Le Chooser lit les définitions à voix haute, dans l'ordre gelé. Les autres
 * n'écoutent qu'avec leurs oreilles — sauf en mode vocal, où ils peuvent
 * déjà voter, sur les numéros seuls (§4.5).
 */
export function Dictate({ view, dispatch, me }: ScreenProps) {
  if (view.isChooser) {
    return (
      <section className="screen screen--dictate">
        <h2>{LABELS.dictateTitle}</h2>
        <p className="muted">{LABELS.dictating}</p>
        <DictationCard view={view} />
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

  if (view.vocal) {
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
