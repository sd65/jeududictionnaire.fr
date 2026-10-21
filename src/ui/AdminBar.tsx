import type { Action } from '../game/reduce';
import { adminBar, type AdminButtonId } from '../game/project';
import type { State } from '../game/state';

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

  return (
    <div className="admin" role="group" aria-label="Commandes de l’hôte">
      {buttons.map((button) => (
        <button
          key={button.id}
          type="button"
          className={button.id === 'end' ? 'btn btn--danger' : 'btn btn--primary'}
          disabled={!button.enabled}
          onClick={() => dispatch(adminAction(button.id, host))}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}
