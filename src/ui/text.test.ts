import { describe, expect, it } from 'vitest';
import { APP_TAGLINE, APP_TITLE } from './text';

describe('le texte de l’application', () => {
  it('a un titre non vide', () => {
    expect(APP_TITLE.length).toBeGreaterThan(0);
  });

  it('annonce un jeu de bluff', () => {
    expect(APP_TITLE).toContain('Dictionnaire');
    expect(APP_TAGLINE).toContain('bluff');
  });
});
