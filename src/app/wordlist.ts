/**
 * Le pack de mots : chargé une fois, en arrière-plan (§6.6).
 *
 * L'application s'affiche d'abord ; la liste arrive ensuite. Tant qu'elle
 * n'est pas là, le Chooser voit un message de chargement et peut saisir un
 * mot à la main (§3 PICK). Si le chargement échoue, il n'y a plus que la
 * saisie manuelle.
 */

import { useEffect, useState } from 'react';
import type { Word } from '../game/words';

export type WordListStatus = 'loading' | 'ready' | 'error';

export type WordList = {
  words: Word[];
  status: WordListStatus;
};

/** Le pack est unique : un seul chargement pour toute l'application. */
let cache: Word[] | null = null;
let pending: Promise<Word[]> | null = null;

/** Le chemin du pack, relatif à l'origine de l'application. */
export const WORDLIST_URL = '/data/wordlist.json';

export function loadWordList(): Promise<Word[]> {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = fetch(WORDLIST_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`liste de mots : ${response.status}`);
        return response.json() as Promise<{ words: Word[] }>;
      })
      .then((payload) => {
        cache = payload.words;
        return cache;
      })
      .catch((error: unknown) => {
        // Un échec ne bloque pas le jeu : on retentera au prochain montage.
        pending = null;
        throw error;
      });
  }
  return pending;
}

/** Le pack, tel que l'application le voit à l'instant présent. */
export function useWordList(): WordList {
  const [list, setList] = useState<WordList>(() =>
    cache ? { words: cache, status: 'ready' } : { words: [], status: 'loading' },
  );

  useEffect(() => {
    if (cache) return;
    let alive = true;
    loadWordList()
      .then((words) => {
        if (alive) setList({ words, status: 'ready' });
      })
      .catch(() => {
        if (alive) setList({ words: [], status: 'error' });
      });
    return () => {
      alive = false;
    };
  }, []);

  return list;
}
