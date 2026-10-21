import { useState } from 'react';
import { readDraft, writeDraft } from '../../store/storage';
import { LABELS } from '../text';
import type { ScreenProps } from '../types';

/** La longueur maximale d'une fausse définition (§3 DRAFT). */
const MAX_LENGTH = 500;

/**
 * La fausse définition (§3 DRAFT).
 *
 * Le mot est diffusé, et chacun écrit **une** fausse définition. Une fois
 * envoyée, elle est verrouillée : le réducteur l refuse en double (§3 DRAFT).
 *
 * Le Chooser, lui, voit les fausses **au fur et à mesure qu'elles
 * arrivent** : c'est lui qui les lit à voix haute (§4.15).
 */
export function Draft({ view, dispatch, me, room }: ScreenProps) {
  // Le texte tapé mais pas encore envoyé est gardé sur l'appareil, par
  // salle : un rechargement ne perd pas la fausse définition (§6.4).
  const [text, setText] = useState(() => readDraft(room));

  const change = (value: string) => {
    setText(value);
    writeDraft(room, value);
  };

  const isWriter = view.isSeated && !view.isChooser;
  const sent = me !== null && view.submitted.some((seat) => seat === me);
  const total = view.expectedWriters.length;

  const send = () => {
    if (me === null) return;
    dispatch({ k: 'def', by: me, text });
    // Envoyé : le brouillon n'a plus lieu d'être (§6.4).
    writeDraft(room, '');
  };

  return (
    <section className="screen screen--draft">
      <h2>{view.word}</h2>
      {view.category ? <p className="muted">{view.category}</p> : null}

      {isWriter && !sent ? (
        <>
          <label className="field">
            <span className="field__label">{LABELS.yourFake}</span>
            <textarea
              className="input"
              rows={4}
              maxLength={MAX_LENGTH}
              value={text}
              onChange={(event) => change(event.target.value)}
            />
          </label>
          <p className="muted counter">
            {text.length} / {MAX_LENGTH}
          </p>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!text.trim()}
            onClick={send}
          >
            {LABELS.send}
          </button>
        </>
      ) : null}

      {isWriter && sent ? <p className="ok">{LABELS.sent}</p> : null}

      <p className="muted">{LABELS.submitted(view.submitted.length, total)}</p>
      {view.submitted.length > 0 ? (
        <ul className="seats seats--inline">
          {view.submitted.map((seat) => (
            <li key={seat} className="seats__seat">
              {seat}
            </li>
          ))}
        </ul>
      ) : null}

      {/*
        Le Chooser lit les définitions à voix haute : il les voit donc
        au fur et à mesure qu'elles arrivent (§4.15). Les rédacteurs, eux,
        ne voient jamais les textes des autres.
      */}
      {view.drafts.length > 0 ? (
        <>
          <h3 className="drafts__title">{LABELS.draftsTitle}</h3>
          <ul className="drafts">
            {view.drafts.map((draft) => (
              <li key={draft.author} className="drafts__item">
                <span className="seats__name">{draft.author}</span>
                <p className="drafts__text">{draft.text}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
