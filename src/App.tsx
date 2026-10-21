import { useEffect, useState } from 'react';
import { useDebugHook } from './app/debug';
import { openHostRoom } from './app/room';
import { setSession, useSession } from './app/session';
import { absenceReason, project } from './game/project';
import { newRoomCode } from './game/room';
import { initialState, type State } from './game/state';
import { createStore } from './store/store';
import { useStore } from './store/useStore';
import { About } from './ui/About/About';
import { AdminBar } from './ui/AdminBar';
import { Home } from './ui/Home/Home';
import { Screen } from './ui/Screen';
import { APP_TITLE, LABELS, MESSAGES } from './ui/text';

/** Un store vide, pour quand aucune salle n'est rejointe. */
const EMPTY = createStore<State>(initialState());

/** Aucun mot exclu, pour quand aucune salle n'est rejointe. */
const NO_EXCLUDED: ReadonlySet<string> = new Set();

/** Le délai d'attente de l'invité (§4.7) : cinq secondes, pas une de plus. */
const JOIN_TIMEOUT = 5000;

/**
 * Le minuteur de l'attente (§4.7).
 *
 * Un seul message, un seul bouton, un seul minuteur dans toute
 * l'application (§4.6).
 */
function useJoinTimeout(active: boolean): boolean {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!active) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), JOIN_TIMEOUT);
    return () => clearTimeout(timer);
  }, [active]);

  return timedOut;
}

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
  const [about, setAbout] = useState(false);

  // Le crochet de débogage : le harnais lit la phase ici (§6.6, §12.11).
  useDebugHook(view);

  const dispatch = session?.dispatch ?? (() => {});
  const excluded = session?.excluded() ?? NO_EXCLUDED;

  // L'invité qui attend l'hôte : au bout de cinq secondes, on le dit (§4.7).
  const absence = absenceReason(view);
  const timedOut = useJoinTimeout(session !== null && absence === 'waiting');

  const goHome = () => {
    session?.leave();
    setSession(null);
  };

  /** Le repli de §4.7 : on devient l'hôte d'un nouveau salon, sans mot dire. */
  const failover = () => {
    if (!session) return;
    session.leave();
    setSession(openHostRoom(newRoomCode(), session.name).session);
  };

  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">{APP_TITLE}</h1>
        <button type="button" className="btn btn--link" onClick={() => setAbout(true)}>
          {LABELS.about}
        </button>
      </header>

      {session ? (
        <>
          {timedOut ? (
            <>
              <p className="error">{MESSAGES.joinTimeout}</p>
              <button type="button" className="btn btn--primary" onClick={failover}>
                {LABELS.createNewRoom}
              </button>
            </>
          ) : null}
          {view.isHost ? (
            <p className="room">
              {LABELS.room} <span className="room__code">{session.room}</span>
            </p>
          ) : null}
          <Screen
            view={view}
            dispatch={dispatch}
            me={session.name}
            excluded={excluded}
            onHome={goHome}
          />
          {view.isHost ? <AdminBar state={state} dispatch={dispatch} /> : null}
        </>
      ) : (
        <Home onOpen={(room) => setSession(room.session)} />
      )}

      {about ? <About onClose={() => setAbout(false)} /> : null}
    </main>
  );
}
