import type { Action } from '../game/reduce';
import type { View } from '../game/project';

/** Ce que reçoit un écran : la projection, et le moyen d'agir. */
export type ScreenProps = {
  view: View;
  dispatch: (action: Action) => void;
};
