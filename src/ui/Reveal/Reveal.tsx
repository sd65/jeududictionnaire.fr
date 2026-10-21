import type { ScreenProps } from '../types';

/** La révélation : les définitions, leurs auteurs, les votes, les points. */
export function Reveal({ view }: ScreenProps) {
  return (
    <section className="screen screen--reveal">
      <h2>La révélation</h2>
      <ol className="ballot">
        {view.options.map((text, index) => (
          <li key={index}>
            <span className="ballot__text">{text}</span>
            {index === view.realIdx ? <span className="badge">vraie</span> : null}
            <span className="muted"> — {view.authors[index] ?? ''}</span>
            <span className="muted"> · {view.votes[index] ?? 0} vote(s)</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
