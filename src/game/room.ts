/**
 * Le code de salle (§3 LOBBY).
 *
 * Quatre lettres, A–Z seulement. Il est **affiché en majuscules** et
 * **transporté en minuscules** : un topic de relais n'accepte que des
 * minuscules.
 *
 * La salle se rejoint par une URL `?room=CODE` : le lien se partage tel quel.
 */

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** La longueur du code de salle. */
export const ROOM_LENGTH = 4;

/** Le code est-il bien quatre lettres ? */
export function isValidRoomCode(code: string): boolean {
  return /^[A-Z]{4}$/.test(code);
}

/**
 * Un nouveau code de salle, tiré au hasard.
 *
 * Le tirage est injectable : les tests n'ont pas besoin de hasard.
 */
export function newRoomCode(rng: () => number = Math.random): string {
  let code = '';
  for (let index = 0; index < ROOM_LENGTH; index += 1) {
    const position = Math.min(LETTERS.length - 1, Math.floor(rng() * LETTERS.length));
    code += LETTERS[position];
  }
  return code;
}

/**
 * Le code lu dans une URL : `?room=abcd` donne « ABCD ».
 *
 * Un code mal formé ne vaut rien : l'invité reste sur l'accueil.
 */
export function roomFromUrl(search: string): string | null {
  let raw: string | null;
  try {
    raw = new URLSearchParams(search).get('room');
  } catch {
    return null;
  }
  if (raw === null) return null;
  const code = raw.trim().toUpperCase();
  return isValidRoomCode(code) ? code : null;
}

/** Le lien de la salle, à partager tel quel. */
export function roomToUrl(code: string): string {
  return `?room=${code.trim().toLowerCase()}`;
}
