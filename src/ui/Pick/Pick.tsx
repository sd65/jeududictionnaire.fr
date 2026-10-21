import { useMemo, useState } from 'react';
import { useWordList } from '../../app/wordlist';
import { deck, deckIndex } from '../../game/words';
import { LABELS, MESSAGES } from '../text';
import type { ScreenProps } from '../types';

/**
 * Le Chooser choisit un mot (§3 PICK).
 *
 * Une pioche de cent cartes, tirée sur l'appareil lui-même dans le pack des
 * mots, moins les mots déjà joués (§4.4). La pioche est circulaire, et elle
 * est **nouvelle à chaque manche** : jamais remélangée pendant le choix.
 *
 * La saisie manuelle est toujours possible : le Chooser doit pouvoir
 * répondre de la définition qu'il propose.
 */
export function Pick({ view, dispatch, me, excluded }: ScreenProps) {
  const { words, status } = useWordList();
  const [index, setIndex] = useState(0);
  const [manual, setManual] = useState(false);
  const [word, setWord] = useState('');
  const [category, setCategory] = useState('');
  const [definition, setDefinition] = useState('');

  // La pioche est tirée une fois par manche : elle ne change pas quand on
  // passe d'une carte à l'autre.
  const cards = useMemo(() => deck(words, excluded, 100), [words, excluded, view.round]);
  const card = cards[index];

  if (!view.isChooser) {
    // Les autres attendent : un seul mot, pas de titre à moitié vide (§4.15).
    return (
      <section className="screen screen--pick">
        <p className="muted">{LABELS.waitingPick}</p>
      </section>
    );
  }

  const choose = (w: string, p: string, d: string) => {
    if (me === null) return;
    dispatch({ k: 'pick', by: me, w, p, d });
  };

  return (
    <section className="screen screen--pick">
      <h2>{LABELS.pickTitle}</h2>

      {status === 'loading' ? <p className="muted">{LABELS.loadingWords}</p> : null}
      {status === 'error' ? <p className="error">{MESSAGES.wordListFailed}</p> : null}

      {card ? (
        <div className="card card--tilt deck">
          <p className="deck__word">{card.w}</p>
          {card.p ? <p className="muted deck__category">{card.p}</p> : null}
          <p className="deck__definition">{card.d}</p>
        </div>
      ) : (
        <p className="muted">{LABELS.emptyDeck}</p>
      )}

      <div className="row row--between">
        <button
          type="button"
          className="btn"
          disabled={cards.length === 0}
          onClick={() => setIndex(deckIndex(index, -1, cards.length))}
        >
          {LABELS.previousCard}
        </button>
        <span className="muted">
          {cards.length === 0 ? '0' : index + 1} / {cards.length}
        </span>
        <button
          type="button"
          className="btn"
          disabled={cards.length === 0}
          onClick={() => setIndex(deckIndex(index, 1, cards.length))}
        >
          {LABELS.nextCard}
        </button>
      </div>

      {card ? (
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => choose(card.w, card.p, card.d)}
        >
          {LABELS.choose}
        </button>
      ) : null}

      <div className="manual">
        <button type="button" className="btn btn--quiet" onClick={() => setManual((open) => !open)}>
          {LABELS.manualEntry}
        </button>

        {manual ? (
          <div className="card">
            <label className="field">
              <span className="field__label">{LABELS.word}</span>
              <input
                className="input"
                type="text"
                value={word}
                maxLength={40}
                onChange={(event) => setWord(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">{LABELS.category}</span>
              <input
                className="input"
                type="text"
                value={category}
                maxLength={20}
                placeholder="n.m."
                onChange={(event) => setCategory(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">{LABELS.definition}</span>
              <textarea
                className="input"
                rows={3}
                value={definition}
                onChange={(event) => setDefinition(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn btn--primary"
              disabled={!word.trim() || !definition.trim()}
              onClick={() => choose(word.trim(), category.trim(), definition.trim())}
            >
              {LABELS.choose}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
