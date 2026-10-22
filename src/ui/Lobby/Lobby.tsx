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

  /** L'hôte change le nombre de tours (§3 LOBBY) : un tour de moins, un de plus. */
  const setTours = (tours: number) =>
    dispatch({ k: 'setOptions', by: host, showDefinitions: view.showDefinitions, tours });

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

      <div className="options">
        <h3 className="options__title">{LABELS.optionsTitle}</h3>
        {view.isHost ? (
          <>
            {/*
              Le nombre de tours d'abord : c'est le réglage que l'hôte touche
              le plus souvent, et il passe avant l'autre (§3 LOBBY).
            */}
            <div className="options__group">
              <div className="options__line">
                <span>{LABELS.tours}</span>
                {/*
                  Pas de champ à remplir : sur mobile, le nombre est pénible à
                  effacer et les boutons du navigateur sont minuscules. Deux
                  boutons — un de moins, un de plus — font le même travail.
                */}
                <div className="stepper">
                  <button
                    type="button"
                    className="btn btn--step"
                    onClick={() => setTours(view.tours - 1)}
                    disabled={view.tours <= 1}
                    aria-label={LABELS.toursLess}
                  >
                    −
                  </button>
                  <span className="stepper__value" aria-live="polite">
                    {view.tours}
                  </span>
                  <button
                    type="button"
                    className="btn btn--step"
                    onClick={() => setTours(view.tours + 1)}
                    aria-label={LABELS.toursMore}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            <div className="options__group">
              <label className="options__line">
                <input
                  type="checkbox"
                  checked={view.showDefinitions}
                  onChange={(event) =>
                    dispatch({
                      k: 'setOptions',
                      by: host,
                      showDefinitions: event.target.checked,
                      tours: view.tours,
                    })
                  }
                />
                <span>{LABELS.showDefinitions}</span>
              </label>
              {/* Ce que veut dire la case, cochée ou pas (§4.5). */}
              <p className="muted options__hint">{LABELS.showDefinitionsHint}</p>
            </div>
          </>
        ) : (
          <p className="muted options__summary">
            {LABELS.tours} : {view.tours} · {LABELS.showDefinitions} :{' '}
            {view.showDefinitions ? 'oui' : 'non'}
          </p>
        )}
      </div>

      {onClearHistory ? (
        <button type="button" className="btn btn--link" onClick={onClearHistory}>
          {LABELS.clearHistory}
        </button>
      ) : null}
    </section>
  );
}
