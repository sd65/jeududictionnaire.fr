import type { Action } from '../../game/reduce';
import type { View } from '../../game/project';
import { LABELS } from '../text';

/** Ce dont le bulletin a besoin : la projection, et le moyen de voter. */
export type BallotProps = {
  view: View;
  dispatch: (action: Action) => void;
  me: string | null;
};

/**
 * La carte de dictation (§4.2).
 *
 * Elle n'existe que sur l'écran du **Chooser**, à partir de DICTATE : l'ordre
 * numéroté et gelé, avec le badge « vraie ». C'est ce qui lui permet de
 * répéter une définition à la demande.
 */
export function DictationCard({ view }: { view: View }) {
  return (
    <ol className="ballot ballot--card">
      {view.options.map((text, index) => (
        <li key={index}>
          <span className="ballot__number">{index + 1}.</span>
          <span className="ballot__text">{text}</span>
          {index === view.realIdx ? <span className="badge badge--real">{LABELS.real}</span> : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * Le bulletin : ce sur quoi on vote (§3 VOTE).
 *
 * En mode vocal, on ne voit que les numéros — et l'on vote dès DICTATE, pour
 * ne pas attendre la fin de la dictée. En mode normal, on voit les
 * définitions, à partir de VOTE seulement.
 *
 * Sa propre définition est **grisée** : on ne vote pas pour soi (§3 VOTE).
 */
export function Ballot({ view, dispatch, me }: BallotProps) {
  return (
    <div className="ballot">
      {Array.from({ length: view.optionsCount }, (_, index) => {
        const own = index === view.myIdx;
        const voted = index === view.myVote;
        return (
          <button
            key={index}
            type="button"
            className={[
              'ballot__option',
              own ? 'ballot__option--own' : '',
              voted ? 'ballot__option--voted' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            disabled={own || !view.canVote}
            onClick={() => {
              if (me === null) return;
              dispatch({ k: 'vote', by: me, idx: index });
            }}
          >
            <span className="ballot__number">{index + 1}.</span>
            {view.showTexts ? <span className="ballot__text">{view.options[index] ?? ''}</span> : null}
          </button>
        );
      })}
      {view.voters > 0 ? (
        <p className="muted">
          {view.voters} {view.voters > 1 ? 'votes' : 'vote'}
        </p>
      ) : null}
    </div>
  );
}
