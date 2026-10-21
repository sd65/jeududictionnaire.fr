/**
 * Tout le texte destiné au joueur est en français et vit dans ce module
 * (PLAN.md §6.6). Le harnais end-to-end clique les boutons par leur libellé
 * (§12.11) : le texte du plan et le texte de l'écran ne peuvent donc pas
 * diverger.
 *
 * Les libellés de boutons sont ceux de §4.15, les messages sont ceux de §4.16.
 */

export const APP_TITLE = 'Jeu du Dictionnaire';

export const APP_TAGLINE = 'Un mot, des définitions et du bluff';

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
  roomCodeInvalid: 'Code de salle : quatre lettres.',
  /** local */
  joinTimeout:
    'On dirait que cela prend plus de temps que d’habitude. Vérifie le code, le Wi-Fi et la connexion Internet — ou lance un nouveau salon.',
  /** local */
  wordListFailed: 'Impossible de charger la liste de mots. Saisie manuelle uniquement.',
  /** local */
  leaveConfirm:
    'Quitter la partie ? Ton siège sera libéré, et la partie attendra ton retour.',
  /** local */
  endConfirm: 'Terminer la partie ? Les points de la manche en cours ne compteront pas.',
} as const;

/** Les libellés de boutons de l'hôte, de §4.15. */
export const BUTTONS = {
  start: 'Démarrer',
  lecture: 'Lecture',
  reveal: 'Révéler',
  next: 'Manche suivante',
  finalRanking: 'Voir le classement',
  end: 'Terminer la partie',
  replay: 'Rejouer',
} as const;

/** Les libellés des écrans et des actions des joueurs. */
export const LABELS = {
  /* L'accueil (§4.14) */
  pseudo: 'Pseudo',
  create: 'Créer une salle',
  join: 'Rejoindre',
  joinRoom: 'Entrer dans la salle',
  roomCode: 'Code de la salle',
  room: 'Salle',
  resume: (code: string) => `Reprendre la salle ${code}`,
  comeback: (code: string) => `Revenir dans la salle ${code}`,
  about: 'À propos',
  cancel: 'Annuler',
  yes: 'Oui',
  createNewRoom: 'Créer un nouveau salon',
  waitingHost: 'En attente de l’hôte…',
  clearHistory: 'Effacer mon historique de mots',
  close: 'Fermer',
  home: 'Accueil',
  backHome: "Retour à l'accueil",
  /** Le menu du coin, toujours présent mais discret (§4.14). */
  menu: 'Menu',

  /* Le salon (§3 LOBBY) */
  table: 'La table',
  vocal: 'Mode vocal seul',
  tours: 'Nombre de tours',
  players: 'Joueurs',
  hostBadge: 'hôte',
  you: 'toi',

  /* Le choix du mot (§3 PICK) */
  pickTitle: 'Choisis un mot',
  waitingPick: 'Le Chooser choisit un mot…',
  choose: '✓ Choisir ce mot',
  previousCard: '‹',
  nextCard: '›',
  manualEntry: 'Saisir un mot à la main',
  word: 'Mot',
  category: 'Catégorie',
  definition: 'Définition',
  loadingWords: 'Chargement de la liste de mots…',
  emptyDeck: 'Plus aucun mot disponible : saisis-en un à la main.',

  /* La fausse définition (§3 DRAFT) */
  draftTitle: 'Écris une fausse définition',
  yourFake: 'Ta fausse définition',
  send: 'Envoyer',
  sent: 'Envoyée !',
  submitted: (done: number, total: number) =>
    `${done} / ${total} ont envoyé la leur.`,
  waitingOthers: 'En attendant les autres…',
  /** Le titre de la liste des fausses, pour le Chooser (§4.15). */
  draftsTitle: 'Les fausses définition, au fur et à mesure',

  /* La dictée (§3 DICTATE) */
  dictateTitle: 'La dictée',
  listening: 'Écoute, et retiens.',
  dictating: 'Dictes les définitions, une par une.',
  validate: 'Passer au vote — tout le monde a entendu',

  /* Le vote (§3 VOTE) */
  voteTitle: 'Le vote',
  voteFor: 'Je crois que c’est la n°',
  voted: 'Vote enregistré.',
  real: 'vraie',

  /* La révélation et la fin (§5) */
  revealTitle: 'La révélation',
  endTitle: 'Le classement',
  roundPoints: 'Points de la manche',
  totalPoints: 'Points au total',
  points: (count: number) => (count > 1 ? `${count} points` : `${count} point`),
  place: (place: number) => `${place}.`,
} as const;
