import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { project, type View } from '../game/project';
import { gameFixture, HOST, PLAYERS, type FixtureStop } from '../test/fixtures';
import { AdminBar } from './AdminBar';
import { Menu } from './Menu/Menu';
import { Screen } from './Screen';
import type { ScreenProps } from './types';

const STOPS: FixtureStop[] = [
  'LOBBY',
  'PICK',
  'DRAFT',
  'DRAFT_SUBMITTED',
  'DICTATE',
  'VOTE',
  'VOTE_VOTED',
  'REVEAL',
  'END',
];

/** Les props d'un écran, sans réseau. */
function propsOf(state: Parameters<typeof project>[0], me: string | null = 'Bob'): ScreenProps {
  return {
    view: project(state, me),
    dispatch: () => {},
    me,
    excluded: new Set<string>(),
    room: 'ABCD',
  };
}

describe('chaque écran', () => {
  it('se rend sans casser, pour chaque phase et chaque rôle', () => {
    for (const stop of STOPS) {
      const state = gameFixture(stop);
      for (const who of PLAYERS) {
        const html = renderToString(<Screen {...propsOf(state, who)} />);
        expect(html.length).toBeGreaterThan(0);
      }
    }
  });

  it('se rend aussi en mode normal', () => {
    const state = gameFixture('VOTE', false);
    const html = renderToString(<Screen {...propsOf(state, 'Bob')} />);
    expect(html).toContain('Fausse de Bob');
  });

  it('montre la table au LOBBY', () => {
    const html = renderToString(<Screen {...propsOf(gameFixture('LOBBY'))} />);
    for (const seat of PLAYERS) expect(html).toContain(seat);
  });

  it('montre le mot en DRAFT', () => {
    const html = renderToString(<Screen {...propsOf(gameFixture('DRAFT'))} />);
    expect(html).toContain('Éléphant');
  });

  it('montre le classement à la fin', () => {
    const html = renderToString(<Screen {...propsOf(gameFixture('END'))} />);
    expect(html).toContain('Le classement');
  });
});

describe('le salon', () => {
  it('montre les options à l’hôte', () => {
    const html = renderToString(<Screen {...propsOf(gameFixture('LOBBY'), HOST)} />);
    expect(html).toContain('Mode vocal seul');
    expect(html).toContain('Nombre de tours');
  });

  it('montre les options aux autres, mais en lecture seule', () => {
    const html = renderToString(<Screen {...propsOf(gameFixture('LOBBY'), 'Bob')} />);
    expect(html).toContain('Nombre de tours');
    // Pas de champ à remplir : les options sont celles de l'hôte.
    expect(html).not.toContain('type="number"');
    expect(html).not.toContain('type="checkbox"');
  });

  it('signale une partie déjà commencée pour un appareil en retard', () => {
    const html = renderToString(<Screen {...propsOf(gameFixture('PICK'), 'Zoé')} />);
    expect(html).toContain('Partie en cours');
  });

  it('fait attendre l’hôte, dans le salon', () => {
    const html = renderToString(<Screen {...propsOf(gameFixture('LOBBY'), 'Zoé')} />);
    expect(html).toContain('En attente de l’hôte');
  });
});

describe('le choix du mot', () => {
  it('n’est proposé qu’au Chooser', () => {
    const state = gameFixture('PICK');
    const chooser = renderToString(<Screen {...propsOf(state, HOST)} />);
    const other = renderToString(<Screen {...propsOf(state, 'Bob')} />);

    expect(chooser).toContain('Choisis un mot');
    expect(other).toContain('Le Chooser choisit un mot');
  });

  it('ne montre pas le titre « Choisis un mot » aux autres', () => {
    const html = renderToString(<Screen {...propsOf(gameFixture('PICK'), 'Bob')} />);
    expect(html).not.toContain('Choisis un mot');
  });
});

describe('la fausse définition', () => {
  it('montre le champ au rédacteur', () => {
    const html = renderToString(<Screen {...propsOf(gameFixture('DRAFT'), 'Bob')} />);
    expect(html).toContain('Ta fausse définition');
    expect(html).toContain('Envoyer');
  });

  it('verrouille le champ après l’envoi', () => {
    const html = renderToString(<Screen {...propsOf(gameFixture('DRAFT_SUBMITTED'), 'Bob')} />);
    expect(html).toContain('Envoyée');
    expect(html).not.toContain('Envoyer');
  });

  it('montre les fausses au Chooser, au fur et à mesure', () => {
    const html = renderToString(<Screen {...propsOf(gameFixture('DRAFT_SUBMITTED'), HOST)} />);
    expect(html).toContain('Fausse de Bob');
    expect(html).toContain('Fausse de Chloé');
    expect(html).toContain('2 / 2');
  });

  it('ne montre aucun texte de faux aux rédacteurs', () => {
    const html = renderToString(<Screen {...propsOf(gameFixture('DRAFT_SUBMITTED'), 'Bob')} />);
    expect(html).not.toContain('Fausse de Chloé');
  });
});

describe('le bulletin', () => {
  it('montre les numéros seuls en mode vocal', () => {
    const html = renderToString(<Screen {...propsOf(gameFixture('DICTATE'), 'Bob')} />);
    expect(html).toContain('ballot__number');
    expect(html).not.toContain('Fausse de Bob');
  });

  it('montre les définitions en mode normal, au VOTE', () => {
    const html = renderToString(<Screen {...propsOf(gameFixture('VOTE', false), 'Bob')} />);
    expect(html).toContain('Fausse de Bob');
  });

  it('grise la propre option d’un rédacteur', () => {
    const state = gameFixture('VOTE', false);
    const html = renderToString(<Screen {...propsOf(state, 'Bob')} />);
    // La fausse de Bob est la sienne : son option est grisée, donc désactivée.
    expect(html).toContain('ballot__option--own');
    expect(html).toContain('disabled');
  });

  it('montre la carte de dictation au Chooser, badge « vraie » compris', () => {
    const html = renderToString(<Screen {...propsOf(gameFixture('DICTATE'), HOST)} />);
    expect(html).toContain('vraie');
    expect(html).toContain('Passer au vote');
  });

  it('ne montre pas la carte de dictation aux autres', () => {
    const html = renderToString(<Screen {...propsOf(gameFixture('DICTATE'), 'Bob')} />);
    expect(html).not.toContain('vraie');
  });
});

describe('la révélation', () => {
  it('montre les auteurs, les votes et les points', () => {
    const html = renderToString(<Screen {...propsOf(gameFixture('REVEAL'), 'Bob')} />);
    expect(html).toContain('vraie');
    expect(html).toContain('Bob');
    expect(html).toContain('Points de la manche');
    expect(html).toContain('Points au total');
  });
});

describe('la barre d’administration', () => {
  it('se rend chez l’hôte', () => {
    const state = gameFixture('LOBBY');
    const html = renderToString(<AdminBar state={state} dispatch={() => {}} />);
    expect(html).toContain('Démarrer');
  });

  it('n’envoie rien toute seule', () => {
    const state = gameFixture('LOBBY');
    const dispatch = vi.fn();
    renderToString(<AdminBar state={state} dispatch={dispatch} />);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('désactive « Démarrer » quand la table est trop petite', () => {
    const state = {
      ...gameFixture('LOBBY'),
      seats: ['Alice', 'Bob'],
      connected: { Alice: true, Bob: true },
    };
    const html = renderToString(<AdminBar state={state} dispatch={() => {}} />);
    expect(html).toContain('disabled');
    expect(state.seats[0]).toBe(HOST);
  });

  it(' garde « Terminer la partie » discret, et ne demande rien tout seul', () => {
    const state = gameFixture('LOBBY');
    const html = renderToString(<AdminBar state={state} dispatch={() => {}} />);
    expect(html).toContain('Terminer la partie');
    // Le bouton discret, pas la confirmation.
    expect(html).toContain('btn--quiet');
    expect(html).not.toContain('Les points de la manche en cours');
  });

  it('ne propose pas « Terminer la partie » à la fin', () => {
    const html = renderToString(<AdminBar state={gameFixture('END')} dispatch={() => {}} />);
    expect(html).not.toContain('Terminer la partie');
  });
});

describe('le menu du coin', () => {
  it('est toujours là', () => {
    const html = renderToString(<Menu inRoom={false} onHome={() => {}} onAbout={() => {}} />);
    expect(html).toContain('aria-label="Menu"');
  });
});

describe('la projection', () => {
  it('reconnaît un pseudo écrit dans une autre casse', () => {
    const state = gameFixture('LOBBY');
    const view: View = project(state, 'alice');
    expect(view.isSeated).toBe(true);
    expect(view.isHost).toBe(true);
  });
});
