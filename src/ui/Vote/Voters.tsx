import type { View } from '../../game/project';
import { LABELS } from '../text';

/**
 * La liste des votants (§3 VOTE).
 *
 * Elle n'est dessinée que pour le **Chooser** : il lui faut savoir qui
 * attend encore, surtout quand les définitions ne sont pas affichées, car
 * les votes arrivent alors pendant qu'il dicte encore.
 *
 * **Qui** a voté, jamais **quoi** : le contenu des votes reste caché
 * jusqu'à la révélation (§3 VOTE, §4.2).
 */
export function Voters({ view }: { view: View }) {
  if (view.voterSeats.length === 0) return null;

  const done = view.voterSeats.filter((voter) => voter.voted).length;

  return (
    <div className="voters">
      <p className="muted">{LABELS.votersCount(done, view.voterSeats.length)}</p>
      <ul className="seats seats--inline">
        {view.voterSeats.map(({ seat, voted }) => (
          <li key={seat} className={voted ? 'seats__seat' : 'seats__seat seats__seat--absent'}>
            <span className="seats__name">{seat}</span>
            <span className={voted ? 'badge badge--voted' : 'badge'}>
              {voted ? LABELS.votedBadge : LABELS.pendingBadge}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
