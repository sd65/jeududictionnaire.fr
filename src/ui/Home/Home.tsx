import { useState } from 'react';
import { openGuestRoom, openHostRoom, roomInUrl, type OpenRoom } from '../../app/room';
import { isValidRoomCode, newRoomCode } from '../../game/room';
import { isValidPseudo } from '../../game/state';
import { isFresh, readHost, readName, readRoom, writeName } from '../../store/storage';
import { APP_TAGLINE, LABELS, MESSAGES } from '../text';

export type HomeProps = {
  /** La salle vient d'être ouverte : l'application passe au salon. */
  onOpen: (room: OpenRoom) => void;
};

/**
 * L'accueil (§4.14).
 *
 * On y crée une salle, on y entre avec un code, et on y revient à la partie
 * d'avant si elle est encore vivante. Le pseudo est le même partout : il
 * est gardé sur l'appareil (§3 LOBBY).
 */
export function Home({ onOpen }: HomeProps) {
  const [name, setName] = useState(() => readName());
  const [code, setCode] = useState(() => roomInUrl() ?? '');
  const [joining, setJoining] = useState(() => roomInUrl() !== null);
  const [error, setError] = useState<string | null>(null);
  // Les offres de reprise sont lues une fois, au montage.
  const [offers] = useState(() => ({ host: readHost(), room: readRoom() }));

  const host = offers.host;
  const room = offers.room;
  const canResume = host !== null && isFresh(host.at) && host.state.seats.length > 0;
  const canComeBack = room !== null && isFresh(room.seenAt);

  /** Le pseudo est-il bon ? Sinon, on le dit et on ne part pas (§4.16). */
  const checkName = (): string | null => {
    const clean = name.trim();
    if (!isValidPseudo(clean)) {
      setError(MESSAGES.pseudoInvalid);
      return null;
    }
    setError(null);
    return clean;
  };

  const create = () => {
    const clean = checkName();
    if (clean === null) return;
    writeName(clean);
    onOpen(openHostRoom(newRoomCode(), clean));
  };

  const join = () => {
    const clean = checkName();
    if (clean === null) return;
    const wanted = code.trim().toUpperCase();
    if (!isValidRoomCode(wanted)) {
      setError(MESSAGES.roomCodeInvalid);
      return;
    }
    writeName(clean);
    onOpen(openGuestRoom(wanted, clean));
  };

  const resume = () => {
    const clean = checkName();
    if (clean === null || host === null) return;
    writeName(clean);
    onOpen(openHostRoom(host.code, clean));
  };

  const comeBack = () => {
    const clean = checkName();
    if (clean === null || room === null) return;
    writeName(clean);
    onOpen(openGuestRoom(room.code, clean));
  };

  /**
   * L'offre à faire, s'il y en a une.
   *
   * La plus récente des deux : une seule à la fois. Deux boutons qui se
   * ressemblent ne font que confondre (§4.14).
   */
  const offer = (() => {
    const hostAt = canResume && host ? host.at : -1;
    const roomAt = canComeBack && room ? room.seenAt : -1;
    if (hostAt < 0 && roomAt < 0) return null;
    if (hostAt >= roomAt && host) {
      return { label: LABELS.resume(host.code), go: resume };
    }
    if (room) return { label: LABELS.comeback(room.code), go: comeBack };
    return null;
  })();

  return (
    <section className="screen screen--home">
      <p className="muted">{APP_TAGLINE}</p>

      {/*
        Les offres de reprise passent **avant** le reste : c'est la seule
        chose que l'appareil a à dire sur une partie qui existe déjà. Une
        seule à la fois — deux boutons qui se ressemblent ne font que
        confondre (§4.14).
      */}
      {offer ? (
        <div className="offers">
          <button type="button" className="btn btn--offer" onClick={offer.go}>
            {offer.label}
          </button>
        </div>
      ) : null}

      <label className="field">
        <span className="field__label">{LABELS.pseudo}</span>
        <input
          className="input"
          type="text"
          value={name}
          maxLength={20}
          autoComplete="off"
          spellCheck={false}
          placeholder="Ton pseudo"
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      {error ? <p className="error">{error}</p> : null}

      {joining ? (
        <>
          <label className="field">
            <span className="field__label">{LABELS.roomCode}</span>
            <input
              className="input input--code"
              type="text"
              value={code}
              maxLength={4}
              autoComplete="off"
              spellCheck={false}
              placeholder="ABCD"
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
          </label>
          {/*
            « Annuler » d'abord, et l'action principale à droite : le bouton
            pressé reste à la place où l'on l'avait trouvé (§4.14).
          */}
          <div className="row">
            <button type="button" className="btn btn--quiet" onClick={() => setJoining(false)}>
              {LABELS.cancel}
            </button>
            <button type="button" className="btn btn--primary" onClick={join}>
              {LABELS.joinRoom}
            </button>
          </div>
        </>
      ) : (
        <div className="row">
          <button type="button" className="btn btn--primary" onClick={create}>
            {LABELS.create}
          </button>
          <button type="button" className="btn btn--primary" onClick={() => setJoining(true)}>
            {LABELS.join}
          </button>
        </div>
      )}
    </section>
  );
}
