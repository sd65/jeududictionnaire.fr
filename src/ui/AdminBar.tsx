import { useEffect, useState } from 'react';
import type { Action } from '../game/reduce';
import { adminBar, type AdminButtonId } from '../game/project';
import type { State } from '../game/state';
import { BUTTONS, LABELS, MESSAGES } from './text';

/** L'action correspondant à un bouton de la barre d'administration. */
export function adminAction(id: AdminButtonId, by: string): Action {
  switch (id) {
    case 'start':
      return { k: 'start', by };
    case 'lecture':
      return { k: 'advance', by };
    case 'reveal':
      return { k: 'reveal', by };
    case 'next':
      return { k: 'next', by };
    case 'end':
      return { k: 'end', by };
    case 'replay':
      return { k: 'replay', by };
  }
}

/**
 * La barre d'administration de l'hôte (§4.15).
 *
 * Elle n'est affichée que chez l'hôte, et ses règles viennent de
 * `adminBar(state)` — une dérivation pure de l'état, testée avec le reste du
 * cœur du jeu (décision 17, §13).
 *
 * « Terminer la partie » est à part : c'est la sortie d secours d'une partie
 * bloquée, pas une commande de jeu. Il est donc **petit et discret**, et il
 * demande confirmation avant de couper la partie en cours (§4.12).
 */
export function AdminBar({
  state,
  dispatch,
}: {
  state: State;
  dispatch: (action: Action) => void;
}) {
  const buttons = adminBar(state);
  const host = state.seats[0] ?? '';
  const [asking, setAsking] = useState(false);

  // Un changement de phase referme la question : elle ne survit pas à la
  // manche suivante.
  useEffect(() => setAsking(false), [state.phase]);

  const others = buttons.filter((button) => button.id !== 'end');
  const canEnd = buttons.some((button) => button.id === 'end');

  return (
    <div className="admin" role="group" aria-label="Commandes de l’hôte">
      {others.map((button) => (
        <button
          key={button.id}
          type="button"
          className="btn btn--primary"
          disabled={!button.enabled}
          onClick={() => dispatch(adminAction(button.id, host))}
        >
          {button.label}
        </button>
      ))}

      {canEnd ? (
        asking ? (
          <div className="admin__confirm">
            <span className="admin__question">{MESSAGES.endConfirm}</span>
            <button
              type="button"
              className="btn btn--danger btn--small"
              onClick={() => {
                setAsking(false);
                dispatch(adminAction('end', host));
              }}
            >
              {LABELS.yes}
            </button>
            <button
              type="button"
              className="btn btn--quiet btn--small"
              onClick={() => setAsking(false)}
            >
              {LABELS.cancel}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn--quiet btn--small"
            onClick={() => setAsking(true)}
          >
            {BUTTONS.end}
          </button>
        )
      ) : null}
    </div>
  );
}
