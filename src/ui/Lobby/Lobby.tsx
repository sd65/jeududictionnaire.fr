import { absenceReason } from '../../game/project';
import { LABELS, MESSAGES } from '../text';
import type { ScreenProps } from '../types';

/**
 * Le salon : la table, qui est arrivé, et les options du jeu (§3 LOBBY).
 *
 * L'hôte règle les options ; les autres les lisent. Le pseudo est la seule
 * chose que l'on change avant de s'asseoir — et il est déjà changé.
 */
export function Lobby({ view, dispatch, onClearHistory }: ScreenProps) {
  const host = view.seats[0] ?? '';
  const absence = absenceReason(view);

  return (
    <section className="screen screen--lobby">
      <h2>{LABELS.table}</h2>

      {view.myError ? <p className="error">{view.myError}</p> : null}
      {absence === 'late' ? <p className="muted">{MESSAGES.gameInProgress}</p> : null}
      {absence === 'waiting' ? <p className="muted">{MESSAGES.reconnecting}</p> : null}

      <ul className="seats">
        {view.seats.map((seat) => (
          <li
            key={seat}
            className={view.connected[seat] ? 'seats__seat' : 'seats__seat seats__seat--absent'}
          >
            <span className="seats__name">{seat}</span>
            {seat === host ? <span className="badge">{LABELS.hostBadge}</span> : null}
            {view.connected[seat] ? null : (
              <span className="muted"> — {MESSAGES.waitingFor(seat)}</span>
            )}
          </li>
        ))}
        {view.seats.length === 0 ? <li className="muted">Personne pour l’instant…</li> : null}
      </ul>

      {view.isHost ? (
        <div className="options">
          <label className="options__line">
            <input
              type="checkbox"
              checked={view.vocal}
              onChange={(event) =>
                dispatch({
                  k: 'setOptions',
                  by: host,
                  vocal: event.target.checked,
                  tours: view.tours,
                })
              }
            />
            <span>{LABELS.vocal}</span>
          </label>
          <label className="options__line">
            <span>{LABELS.tours}</span>
            <input
              className="input input--number"
              type="number"
              min={1}
              step={1}
              value={view.tours}
              onChange={(event) =>
                dispatch({
                  k: 'setOptions',
                  by: host,
                  vocal: view.vocal,
                  tours: Number(event.target.value),
                })
              }
            />
          </label>
        </div>
      ) : (
        <p className="muted">
          {LABELS.vocal} : {view.vocal ? 'oui' : 'non'} · {LABELS.tours} : {view.tours}
        </p>
      )}

      {onClearHistory ? (
        <button type="button" className="btn btn--link" onClick={onClearHistory}>
          {LABELS.clearHistory}
        </button>
      ) : null}
    </section>
  );
}
