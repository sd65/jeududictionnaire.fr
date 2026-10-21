import type { ScreenProps } from '../types';

/** La fin : le classement. */
export function End({ view }: ScreenProps) {
  return (
    <section className="screen screen--end">
      <h2>Le classement</h2>
      <ol className="ranking">
        {view.ranking.map((row) => (
          <li key={row.seat}>
            <span className="ranking__place">{row.place}.</span> {row.seat}
            <span className="muted"> — {row.score} point(s)</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
