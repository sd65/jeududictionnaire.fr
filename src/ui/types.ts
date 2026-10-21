import type { Action } from '../game/reduce';
import type { View } from '../game/project';

/** Ce que reçoit un écran : la projection, et le moyen d'agir. */
export type ScreenProps = {
  view: View;
  dispatch: (action: Action) => void;
  /** Le pseudo de cet appareil : c'est lui qu'on signe. */
  me: string | null;
  /** Les mots exclus sur cet appareil : l'historique local ∪ l'union (§4.4). */
  excluded: ReadonlySet<string>;
  /** Revenir à l'accueil — libère l'appareil (§4.14). */
  onHome?: () => void;
};
