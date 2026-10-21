import { LABELS } from '../text';
import type { ScreenProps } from '../types';

/**
 * La fin de la partie (§5).
 *
 * Le classement, classement dense : les ex æquo partagent la place, et la
 * suivante suit immédiatement.
 */
export function End({ view }: ScreenProps) {
  return (
    <section className="screen screen--end">
      <h2>{LABELS.endTitle}</h2>

      <ol className="ranking">
        {view.ranking.map((row) => (
          <li key={row.seat}>
            <span className="ranking__place">{LABELS.place(row.place)}</span>
            <span className="ranking__seat">{row.seat}</span>
            <span className="muted"> — {LABELS.points(row.score)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
