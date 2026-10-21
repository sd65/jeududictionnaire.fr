/**
 * La projection : ce qu'un appareil a le droit de dessiner, donné l'état et
 * son pseudo (§4.2).
 *
 * C'est la **seule** place où « qui voit quoi » se décide. Rien n'est filtré
 * sur le réseau (§6.5) : l'état voyage tel quel, et chaque client dessine à
 * partir de sa propre projection. La fonction est donc pure, et c'est
 * exactement ce que les tests couvrent (§6.7).
 *
 * L'hôte ne fait pas exception : il projette pour son propre siège comme
 * les autres. Sa barre d'administration est une dérivation séparée, plus
 * petite, de l'état.
 */

import { BUTTONS } from '../ui/text';
import { rank, roundPoints, type Standing } from './scoring';
import { expectedWriters, hostOf, seatIndex, totalRounds, type Author, type Phase, type State } from './state';

export type View = {
  phase: Phase;
  /** Cet appareil est-il assis à la table ? */
  isSeated: boolean;
  isHost: boolean;
  isChooser: boolean;
  /**
   * Le vote est accepté exactement quand le bulletin est visible à ce
   * joueur (§3 VOTE). La formule est celle du plan :
   * `phase === 'VOTE' || (phase === 'DICTATE' && vocal)`. Le Chooser et un
   * appareil non assis ne votent pas, même si le bulletin est visible.
   */
  canVote: boolean;
  /** Les textes du bulletin sont affichables (mode normal, phase VOTE). */
  showTexts: boolean;
  /** Le nombre d'options du bulletin (1…N). */
  optionsCount: number;
  /** Les textes des options, dans l'ordre gelé. Vide si la phase ne les montre pas. */
  options: string[];
  /** L'auteur de chaque option. Vide si la phase ne les montre pas. */
  authors: Author[];
  /** L'index de la fausse définition du joueur, ou −1. */
  myIdx: number;
  /** L'index de la vraie définition, ou −1. */
  realIdx: number;
  /** Le mot et sa catégorie. */
  word: string;
  category: string;
  /** La vraie définition — pour le Chooser seulement, à partir de DICTATE. */
  realDef: string;
  /** Les pseudos qui ont envoyé leur fausse définition (sans les textes). */
  submitted: string[];
  /** Le nombre de votes exprimés (agrégat, jamais le détail). */
  voters: number;
  /** Le nombre de votes par option — au Révél seulement. */
  votes: number[];
  /** Les points de la manche — au Révél seulement. */
  roundPoints: Record<string, number>;
  /** Les scores cumulés — au Révél et à la fin. */
  scores: Record<string, number>;
  /** Le classement — au Révél et à la fin. */
  ranking: Standing[];
  /** Les sièges, dans l'ordre d'arrivée. */
  seats: string[];
  /** Par siège : est-il connecté ? */
  connected: Record<string, boolean>;
  /** Les sièges déconnectés. */
  waitingFor: string[];
  /** Le message adressé à ce joueur, s'il y en a un. */
  myError: string | null;
  round: number;
  totalRounds: number;
  tours: number;
  vocal: boolean;
  /** Les joueurs attendus comme rédacteurs (le Chooser exclu). */
  expectedWriters: string[];
};

export function project(state: State, me: string | null): View {
  const phase = state.phase;
  const seats = state.seats;
  const host = hostOf(state);
  const isSeated = me !== null && seatIndex(state, me) >= 0;
  const isHost = me !== null && host !== null && me === host;
  const isChooser = me !== null && me === state.chooser;
  const vocal = state.vocal;

  // Le bulletin est visible : la règle unique de vote, dans les deux modes.
  const ballotVisible = phase === 'VOTE' || (phase === 'DICTATE' && vocal);
  const canVote = ballotVisible && isSeated && !isChooser;

  // La carte de dictation du Chooser : l'ordre numéroté et le badge « vraie ».
  // Elle existe à partir de DICTATE, sur son écran seulement (§4.2).
  const dictationCard = isChooser && (phase === 'DICTATE' || phase === 'VOTE');

  const showWord = phase === 'DRAFT' || phase === 'REVEAL';
  const showTexts = phase === 'VOTE' && !vocal;
  const showAuthors = phase === 'REVEAL';
  const showSubmitted = phase === 'DRAFT';
  const showVoters = (phase === 'DICTATE' && vocal) || phase === 'VOTE';
  const showVotes = phase === 'REVEAL';
  const showScores = phase === 'REVEAL' || phase === 'END';

  // Les numéros 1…N : en mode vocal dès DICTATE, en mode normal au VOTE,
  // plus la carte de dictation du Chooser (§4.2).
  const showNumbers = ballotVisible || phase === 'REVEAL' || dictationCard;
  // Les textes : en mode normal au VOTE, au Révél, et sur la carte de
  // dictation du Chooser — qui doit lire les définitions à voix haute.
  const showOptions = showTexts || phase === 'REVEAL' || dictationCard;

  const optionText = (author: Author): string =>
    author === 'real' ? state.realDef : (state.fakes[author] ?? '');

  const voteCounts = state.ballot.map(() => 0);
  for (const index of Object.values(state.votes)) {
    const current = voteCounts[index];
    if (current !== undefined) voteCounts[index] = current + 1;
  }

  const submitted = state.seats.filter((seat) => seat in state.fakes);
  const points = roundPoints(state.ballot, state.votes);
  const standing = rank(state.scores, seats);

  // Un appareil qui n'est pas à la table ne voit rien du jeu : il lit la
  // phase dans l'état et en déduit qu'il est arrivé trop tard (§4.8).
  if (!isSeated) {
    return {
      phase,
      isSeated: false,
      isHost: false,
      isChooser: false,
      canVote: false,
      showTexts: false,
      optionsCount: 0,
      options: [],
      authors: [],
      myIdx: -1,
      realIdx: -1,
      word: '',
      category: '',
      realDef: '',
      submitted: [],
      voters: 0,
      votes: [],
      roundPoints: {},
      scores: {},
      ranking: [],
      seats,
      connected: state.connected,
      waitingFor: seats.filter((seat) => !state.connected[seat]),
      myError: null,
      round: state.round,
      totalRounds: totalRounds(state),
      tours: state.tours,
      vocal,
      expectedWriters: [],
    };
  }

  return {
    phase,
    isSeated: true,
    isHost,
    isChooser,
    canVote,
    showTexts,
    optionsCount: showNumbers ? state.ballot.length : 0,
    options: showOptions ? state.ballot.map(optionText) : [],
    authors: showAuthors ? state.ballot.slice() : [],
    myIdx: me === null || !showNumbers ? -1 : state.ballot.findIndex((author) => author === me),
    realIdx:
      phase === 'REVEAL' || dictationCard ? state.ballot.indexOf('real') : -1,
    word: showWord ? state.word : '',
    category: showWord ? state.category : '',
    realDef: dictationCard ? state.realDef : '',
    submitted: showSubmitted ? submitted : [],
    voters: showVoters ? Object.keys(state.votes).length : 0,
    votes: showVotes ? voteCounts : [],
    roundPoints: showVotes ? points : {},
    scores: showScores ? { ...state.scores } : {},
    ranking: showScores ? standing : [],
    seats,
    connected: state.connected,
    waitingFor: seats.filter((seat) => !state.connected[seat]),
    myError: me === null ? null : (state.errors[me] ?? null),
    round: state.round,
    totalRounds: totalRounds(state),
    tours: state.tours,
    vocal,
    expectedWriters: expectedWriters(state),
  };
}

/* ------------------------------------------------------------------------ */
/* La barre d'administration de l'hôte : une dérivation séparée de l'état.   */
/* ------------------------------------------------------------------------ */

export type AdminButtonId = 'start' | 'lecture' | 'reveal' | 'next' | 'end' | 'replay';

export type AdminButton = {
  id: AdminButtonId;
  label: string;
  enabled: boolean;
};

export function adminBar(state: State): AdminButton[] {
  const buttons: AdminButton[] = [];
  const blocked = state.seats.some((seat) => !state.connected[seat]);

  switch (state.phase) {
    case 'LOBBY':
      buttons.push({
        id: 'start',
        label: BUTTONS.start,
        enabled: state.seats.length >= 3 && !blocked,
      });
      break;
    case 'PICK':
      break;
    case 'DRAFT': {
      const allIn = expectedWriters(state).every((writer) => writer in state.fakes);
      buttons.push({ id: 'lecture', label: BUTTONS.lecture, enabled: allIn && !blocked });
      break;
    }
    case 'DICTATE':
      // C'est le Chooser qui valide, pas l'hôte (§4.15).
      break;
    case 'VOTE': {
      const allVoted = expectedWriters(state).every((writer) => writer in state.votes);
      buttons.push({ id: 'reveal', label: BUTTONS.reveal, enabled: allVoted && !blocked });
      break;
    }
    case 'REVEAL': {
      const last = state.round >= totalRounds(state);
      buttons.push({
        id: 'next',
        label: last ? BUTTONS.finalRanking : BUTTONS.next,
        enabled: !blocked,
      });
      break;
    }
    case 'END':
      // L'écran de fin n'a qu'un bouton (§5).
      return [{ id: 'replay', label: BUTTONS.replay, enabled: true }];
  }

  // « Terminer la partie » est disponible dans toutes les phases : c'est la
  // seule sortie d'une partie bloquée (§4.12).
  buttons.push({ id: 'end', label: BUTTONS.end, enabled: true });
  return buttons;
}
