import { LABELS } from '../text';
import type { ScreenProps } from '../types';

/**
 * La révélation (§3 REVEAL).
 *
 * Chaque définition avec son auteur, la vraie marquée « vraie », les votes
 * reçus par ligne, puis les points de la manche et les scores cumulés.
 */
export function Reveal({ view }: ScreenProps) {
  return (
    <section className="screen screen--reveal">
      <h2>{LABELS.revealTitle}</h2>

      <ol className="ballot ballot--reveal">
        {view.options.map((text, index) => {
          const author = view.authors[index];
          const votes = view.votes[index] ?? 0;
          return (
            <li key={index}>
              <span className="ballot__number">{index + 1}.</span>
              <span className="ballot__text">{text}</span>
              {index === view.realIdx ? <span className="badge badge--real">{LABELS.real}</span> : null}
              {author && author !== 'real' ? (
                <span className="muted"> — {author}</span>
              ) : null}
              <span className="muted">
                {' · '}
                {votes} {votes > 1 ? 'votes' : 'vote'}
              </span>
            </li>
          );
        })}
      </ol>

      <h3>{LABELS.roundPoints}</h3>
      <ul className="points">
        {Object.entries(view.roundPoints).map(([seat, points]) => (
          <li key={seat}>
            {seat} <span className="muted">+{points}</span>
          </li>
        ))}
        {Object.keys(view.roundPoints).length === 0 ? (
          <li className="muted">Personne n’a marqué de point cette manche.</li>
        ) : null}
      </ul>

      <h3>{LABELS.totalPoints}</h3>
      <ul className="points">
        {view.seats.map((seat) => (
          <li key={seat}>
            {seat} <span className="muted">{view.scores[seat] ?? 0}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
