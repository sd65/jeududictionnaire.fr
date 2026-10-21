import type { ScreenProps } from '../types';

/** Le salon : la table, qui est arrivé, et les options du jeu. */
export function Lobby({ view }: ScreenProps) {
  return (
    <section className="screen screen--lobby">
      <h2>La table</h2>
      <ul className="seats">
        {view.seats.map((seat) => (
          <li key={seat} className={view.connected[seat] ? undefined : 'seats__seat--absent'}>
            {seat}
          </li>
        ))}
      </ul>
      <p className="muted">
        Mode vocal : {view.vocal ? 'oui' : 'non'} · Tours : {view.tours}
      </p>
    </section>
  );
}
