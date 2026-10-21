/**
 * Tout le texte destiné au joueur est en français et vit dans ce module
 * (PLAN.md §6.6). Le harnais end-to-end clique les boutons par leur libellé
 * (§12.11) : le texte du plan et le texte de l'écran ne peuvent donc pas
 * diverger.
 *
 * Les libellés de boutons sont ceux de §4.15, les messages sont ceux de §4.16.
 */

export const APP_TITLE = 'Jeu du Dictionnaire';

export const APP_TAGLINE = 'Un mot, des définitions, des bluffers.';

/** Les messages de §4.16, avec leur origine (§4.2 : local, state ou seat). */
export const MESSAGES = {
  /** local */
  pseudoInvalid: 'Pseudo : 3 à 20 caractères, lettres et chiffres.',
  /** state (un siège connecté porte déjà ce pseudo) */
  pseudoTaken: 'Ce pseudo est déjà pris dans cette salle.',
  /** state (`phase !== 'LOBBY'`) */
  gameInProgress: 'Partie en cours — rejoins la prochaine partie.',
  /** seat */
  wordAlreadyPlayed: 'Ce mot a déjà été joué.',
  /** seat */
  ownFake: 'Tu ne peux pas voter pour ta propre définition.',
  /** state */
  waitingFor: (pseudo: string) => `En attente de ${pseudo}`,
  /** state */
  hostDisconnected: 'Hôte déconnecté — en attente de son retour',
  /** local */
  reconnecting: 'Reconnexion…',
  /** local */
  unstable: 'Connexion instable',
  /** local */
  wordListFailed: 'Impossible de charger la liste de mots. Saisie manuelle uniquement.',
} as const;

/** Les libellés des boutons de l'hôte, de §4.15. */
export const BUTTONS = {
  start: 'Démarrer',
  lecture: 'Lecture',
  reveal: 'Révéler',
  next: 'Manche suivante',
  finalRanking: 'Voir le classement',
  end: 'Terminer la partie',
  replay: 'Rejouer',
} as const;
