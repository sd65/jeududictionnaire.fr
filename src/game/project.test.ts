import { describe, expect, it } from 'vitest';
import { BUTTONS } from '../ui/text';
import { gameFixture, HOST, PLAYERS, WRITERS, type FixtureStop } from '../test/fixtures';
import { reduce } from './reduce';
import { adminBar, project } from './project';

const build = gameFixture;

describe('la projection selon la phase', () => {
  it('au LOBBY, personne ne voit de contenu de jeu', () => {
    const view = project(build('LOBBY'), 'Bob');
    expect(view.phase).toBe('LOBBY');
    expect(view.isSeated).toBe(true);
    expect(view.word).toBe('');
    expect(view.options).toEqual([]);
    expect(view.optionsCount).toBe(0);
    expect(view.authors).toEqual([]);
    expect(view.canVote).toBe(false);
    expect(view.showTexts).toBe(false);
    expect(view.myIdx).toBe(-1);
    expect(view.realIdx).toBe(-1);
    expect(view.realDef).toBe('');
  });

  it('au PICK, seul le Chooser sait qu’il choisit', () => {
    const state = build('PICK');
    expect(project(state, HOST).isChooser).toBe(true);
    expect(project(state, 'Bob').isChooser).toBe(false);
    expect(project(state, 'Bob').isSeated).toBe(true);
  });

  it('au PICK, le mot n’est pas encore diffusé', () => {
    const view = project(build('PICK'), 'Bob');
    expect(view.word).toBe('');
    expect(view.category).toBe('');
  });

  it('en DRAFT, tout le monde voit le mot et sa catégorie', () => {
    const view = project(build('DRAFT'), 'Bob');
    expect(view.word).toBe('Éléphant');
    expect(view.category).toBe('n.m.');
  });

  it('en DRAFT, personne ne voit les fausses définitions', () => {
    const state = build('DRAFT_SUBMITTED');
    for (const who of PLAYERS) {
      const view = project(state, who);
      expect(view.options).toEqual([]);
      expect(view.authors).toEqual([]);
      expect(view.realDef).toBe('');
      expect(view.realIdx).toBe(-1);
    }
  });

  it('en DRAFT, on voit qui a envoyé sa fausse, pas ce qu’il a écrit', () => {
    const view = project(build('DRAFT_SUBMITTED'), 'Bob');
    expect(view.submitted).toEqual(WRITERS);
  });

  it('en DICTATE vocal, le joueur voit les numéros mais pas les textes', () => {
    const view = project(build('DICTATE'), 'Bob');
    expect(view.optionsCount).toBe(3);
    expect(view.options).toEqual([]);
    expect(view.canVote).toBe(true);
    expect(view.realIdx).toBe(-1);
    expect(view.realDef).toBe('');
  });

  it('en DICTATE normal, le joueur ne voit ni les numéros ni les textes', () => {
    const view = project(build('DICTATE', false), 'Bob');
    expect(view.optionsCount).toBe(0);
    expect(view.options).toEqual([]);
    expect(view.canVote).toBe(false);
  });

  it('le Chooser garde sa carte de dictation, badge « vraie » compris', () => {
    const view = project(build('DICTATE'), HOST);
    expect(view.options).toHaveLength(3);
    expect(view.realIdx).toBe(0);
    expect(view.realDef).toBe('Un grand mammifère.');
    expect(view.canVote).toBe(false);
  });

  it('le Chooser ne voit pas qui a écrit quoi', () => {
    expect(project(build('DICTATE'), HOST).authors).toEqual([]);
  });

  it('au VOTE vocal, on voit les numéros, pas les textes', () => {
    const view = project(build('VOTE'), 'Bob');
    expect(view.optionsCount).toBe(3);
    expect(view.options).toEqual([]);
    expect(view.canVote).toBe(true);
  });

  it('au VOTE normal, on voit les définitions numérotées', () => {
    const view = project(build('VOTE', false), 'Bob');
    expect(view.options).toEqual([
      'Un grand mammifère.',
      'Fausse de Bob',
      'Fausse de Chloé',
    ]);
    expect(view.showTexts).toBe(true);
    expect(view.canVote).toBe(true);
  });

  it('au VOTE, chacun connaît l’index de sa propre fausse', () => {
    const state = build('VOTE');
    expect(project(state, 'Bob').myIdx).toBe(1);
    expect(project(state, 'Chloé').myIdx).toBe(2);
    expect(project(state, HOST).myIdx).toBe(-1);
  });

  it('au VOTE, on ne voit que le nombre de votes, jamais le détail', () => {
    const view = project(build('VOTE_VOTED'), 'Bob');
    expect(view.voters).toBe(2);
    expect(view.votes).toEqual([]);
  });

  it('au RÉVÉL, tout le monde voit les textes, les auteurs et les votes', () => {
    const view = project(build('REVEAL'), 'Bob');
    expect(view.options).toHaveLength(3);
    expect(view.authors).toEqual(['real', 'Bob', 'Chloé']);
    expect(view.realIdx).toBe(0);
    expect(view.votes).toEqual([1, 1, 0]);
    expect(view.word).toBe('Éléphant');
  });

  it('au RÉVÉL, les scores et le classement sont visibles', () => {
    const view = project(build('REVEAL'), 'Bob');
    expect(view.scores).toEqual({ Bob: 2 });
    expect(view.ranking.map((row) => row.seat)).toEqual(['Bob', 'Alice', 'Chloé']);
    expect(view.ranking.map((row) => row.place)).toEqual([1, 2, 2]);
  });

  it('à la fin, le classement reste visible', () => {
    const view = project(build('END'), 'Bob');
    expect(view.phase).toBe('END');
    expect(view.ranking.length).toBeGreaterThan(0);
  });
});

describe('la règle unique de vote', () => {
  const stops: FixtureStop[] = ['LOBBY', 'PICK', 'DRAFT', 'DICTATE', 'VOTE', 'REVEAL', 'END'];

  it('vaut phase === VOTE || (phase === DICTATE && vocal), pour tout rédacteur', () => {
    for (const stop of stops) {
      for (const vocal of [true, false]) {
        const state = build(stop, vocal);
        for (const writer of WRITERS) {
          const expected =
            state.phase === 'VOTE' || (state.phase === 'DICTATE' && state.vocal);
          expect(project(state, writer).canVote).toBe(expected);
        }
      }
    }
  });

  it('ne s’applique jamais au Chooser', () => {
    for (const stop of stops) {
      expect(project(build(stop), HOST).canVote).toBe(false);
    }
  });
});

describe('la projection d’un appareil qui n’est pas à la table', () => {
  it('ne montre rien du jeu', () => {
    const view = project(build('REVEAL'), 'Zoé');
    expect(view.isSeated).toBe(false);
    expect(view.options).toEqual([]);
    expect(view.word).toBe('');
    expect(view.scores).toEqual({});
    expect(view.votes).toEqual([]);
  });

  it('montre quand même la phase, pour savoir qu’il est arrivé trop tard', () => {
    expect(project(build('REVEAL'), 'Zoé').phase).toBe('REVEAL');
  });
});

describe('les ожиes du joueur', () => {
  it('l’erreur qui le concerne', () => {
    let state = build('VOTE');
    state = reduce(state, { k: 'vote', by: 'Bob', idx: 1 });
    expect(project(state, 'Bob').myError).not.toBeNull();
    expect(project(state, 'Chloé').myError).toBeNull();
  });

  it('la liste des sièges déconnectés', () => {
    let state = build('LOBBY');
    state = reduce(state, { k: 'leave', by: 'Chloé' });
    expect(project(state, 'Bob').waitingFor).toEqual(['Chloé']);
  });
});

describe('la barre d’administration', () => {
  it('au LOBBY, « Démarrer » attend trois joueurs connectés', () => {
    const state = build('LOBBY');
    const button = adminBar(state).find((b) => b.id === 'start');
    expect(button?.label).toBe(BUTTONS.start);
    expect(button?.enabled).toBe(true);
  });

  it('au LOBBY, « Démarrer » est désactivé si un joueur est parti', () => {
    let state = build('LOBBY');
    state = reduce(state, { k: 'leave', by: 'Chloé' });
    expect(adminBar(state).find((b) => b.id === 'start')?.enabled).toBe(false);
  });

  it('au PICK et en DICTATE, l’hôte n’a que « Terminer la partie »', () => {
    expect(adminBar(build('PICK')).map((b) => b.id)).toEqual(['end']);
    expect(adminBar(build('DICTATE')).map((b) => b.id)).toEqual(['end']);
  });

  it('en DRAFT, « Lecture » attend toutes les fausses', () => {
    expect(adminBar(build('DRAFT')).find((b) => b.id === 'lecture')?.enabled).toBe(false);
    expect(adminBar(build('DRAFT_SUBMITTED')).find((b) => b.id === 'lecture')?.enabled).toBe(true);
  });

  it('au VOTE, « Révéler » attend tous les votes, mais reste forçable', () => {
    const waiting = adminBar(build('VOTE')).find((b) => b.id === 'reveal');
    expect(waiting?.enabled).toBe(false);
    const done = adminBar(build('VOTE_VOTED')).find((b) => b.id === 'reveal');
    expect(done?.enabled).toBe(true);
    expect(adminBar(build('VOTE')).some((b) => b.id === 'end')).toBe(true);
  });

  it('au RÉVÉL, le bouton s’appelle « Manche suivante »', () => {
    expect(adminBar(build('REVEAL')).find((b) => b.id === 'next')?.label).toBe(BUTTONS.next);
  });

  it('à la dernière manche, le bouton s’appelle « Voir le classement »', () => {
    let state = build('REVEAL');
    state = { ...state, round: 6 };
    expect(adminBar(state).find((b) => b.id === 'next')?.label).toBe(BUTTONS.finalRanking);
  });

  it('à la fin, il n’y a qu’un bouton : « Rejouer »', () => {
    const buttons = adminBar(build('END'));
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.label).toBe(BUTTONS.replay);
  });
});
