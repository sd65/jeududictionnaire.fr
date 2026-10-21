import { useSession } from './app/session';
import { project } from './game/project';
import { initialState, type State } from './game/state';
import { createStore } from './store/store';
import { useStore } from './store/useStore';
import { AdminBar } from './ui/AdminBar';
import { Home } from './ui/Home/Home';
import { Screen } from './ui/Screen';
import { APP_TITLE } from './ui/text';

/** Un store vide, pour quand aucune salle n'est rejointe. */
const EMPTY = createStore<State>(initialState());

/**
 * La coque de l'application (§6.6).
 *
 * L'écran se choisit sur la phase ; la barre d'administration n'apparaît que
 * chez l'hôte. Tout le reste est dans l'écran lui-même.
 */
export function App() {
  const session = useSession();
  const state = useStore(session?.store ?? EMPTY);
  const view = project(state, session?.name ?? null);

  return (
    <main className="app">
      <h1 className="app__title">{APP_TITLE}</h1>
      {session ? (
        <>
          <Screen view={view} dispatch={session.dispatch} />
          {view.isHost ? <AdminBar state={state} dispatch={session.dispatch} /> : null}
        </>
      ) : (
        <Home />
      )}
    </main>
  );
}
