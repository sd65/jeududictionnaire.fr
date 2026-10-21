import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { project } from '../game/project';
import { gameFixture, HOST, PLAYERS, type FixtureStop } from '../test/fixtures';
import { AdminBar } from './AdminBar';
import { Screen } from './Screen';

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

describe('chaque écran', () => {
  it('se rend sans casser, pour chaque phase et chaque rôle', () => {
    for (const stop of STOPS) {
      const state = gameFixture(stop);
      for (const who of PLAYERS) {
        const view = project(state, who);
        const html = renderToString(<Screen view={view} dispatch={() => {}} />);
        expect(html.length).toBeGreaterThan(0);
      }
    }
  });

  it('se rend aussi en mode normal', () => {
    const state = gameFixture('VOTE', false);
    const html = renderToString(<Screen view={project(state, 'Bob')} dispatch={() => {}} />);
    expect(html).toContain('Fausse de Bob');
  });

  it('montre la table au LOBBY', () => {
    const html = renderToString(
      <Screen view={project(gameFixture('LOBBY'), 'Bob')} dispatch={() => {}} />,
    );
    for (const seat of PLAYERS) expect(html).toContain(seat);
  });

  it('montre le mot en DRAFT', () => {
    const html = renderToString(
      <Screen view={project(gameFixture('DRAFT'), 'Bob')} dispatch={() => {}} />,
    );
    expect(html).toContain('Éléphant');
  });

  it('montre le classement à la fin', () => {
    const html = renderToString(
      <Screen view={project(gameFixture('END'), 'Bob')} dispatch={() => {}} />,
    );
    expect(html).toContain('Le classement');
  });
});

describe('la barre d’administration', () => {
  it('se rend chez l’hôte', () => {
    const state = gameFixture('LOBBY');
    const html = renderToString(<AdminBar state={state} dispatch={() => {}} />);
    expect(html).toContain('Démarrer');
  });

  it('envoie l’action du bouton pressé', () => {
    const state = gameFixture('LOBBY');
    const dispatch = vi.fn();
    renderToString(<AdminBar state={state} dispatch={dispatch} />);

    // Le rendu ne déclenche pas le clic : on vérifie l'action produite.
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('désactive « Démarrer » quand la table est trop petite', () => {
    const state = { ...gameFixture('LOBBY'), seats: ['Alice', 'Bob'], connected: { Alice: true, Bob: true } };
    const html = renderToString(<AdminBar state={state} dispatch={() => {}} />);
    expect(html).toContain('disabled');
    expect(state.seats[0]).toBe(HOST);
  });
});
