import { useEffect, useState } from 'react';
import { useDebugHook } from './app/debug';
import { useWakeLock } from './app/wakelock';
import { openGuestRoom, openHostRoom, roomInUrl } from './app/room';
import { setSession, useSession } from './app/session';
import { absenceReason, project } from './game/project';
import { newRoomCode } from './game/room';
import { isValidPseudo, initialState, type State } from './game/state';
import { createStore } from './store/store';
import { isFresh, readHost, readName, readRoom } from './store/storage';
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
 * La reprise au démarrage (§4.9, §4.11, §4.14).
 *
 * L'URL porte le code de la salle : c'est la seule chose qui survive à un
 * rechargement. Si l'appareil avait cette salle — comme hôte ou comme invité
 * — il y retourne, sans que personne ait à rien cliquer.
 */
function useRestoreOnLaunch(): void {
  useEffect(() => {
    const code = roomInUrl();
    if (!code) return;

    // L'hôte : il retrouve la partie, et les autres le retrouve (§4.11).
    const host = readHost();
    if (host && host.code === code && isFresh(host.at) && host.state.seats.length > 0) {
      const name = host.state.seats[0] ?? readName();
      if (isValidPseudo(name)) setSession(openHostRoom(code, name).session);
      return;
    }

    // L'invité : il redit bonjour, et reprend sa place (§4.9).
    const last = readRoom();
    if (last && last.code === code && isFresh(last.seenAt)) {
      const name = readName();
      if (isValidPseudo(name)) setSession(openGuestRoom(code, name).session);
    }
  }, []);
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
  useRestoreOnLaunch();
  // L'écran ne s'éteint pas, sur chaque appareil (§4.13).
  useWakeLock(session !== null);

  const dispatch = session?.dispatch ?? (() => {});
  const excluded = session?.excluded() ?? NO_EXCLUDED;

  // L'invité qui attend l'hôte : au bout de cinq secondes, on le dit (§4.7).
  const absence = absenceReason(view);
  const timedOut = useJoinTimeout(session !== null && absence === 'waiting');

  const goHome = () => {
    session?.leave();
    setSession(null);
  };

  /** « Effacer mon historique de mots » : cet appareil seul (§4.4). */
  const clearHistory = () => {
    session?.clearHistory();
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
            room={session.room}
            onHome={goHome}
            onClearHistory={clearHistory}
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
