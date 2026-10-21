import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { About } from './About/About';
import { Home } from './Home/Home';
import { LABELS } from './text';

describe('l’accueil', () => {
  const html = renderToString(<Home onOpen={() => {}} />);

  it('demande un pseudo', () => {
    expect(html).toContain(LABELS.pseudo);
  });

  it('propose de créer une salle, ou d’en rejoindre une', () => {
    expect(html).toContain(LABELS.create);
    expect(html).toContain(LABELS.join);
  });

  it('ne propose rien à reprendre sans salle stockée', () => {
    expect(html).not.toContain('Reprendre la salle');
    expect(html).not.toContain('Revenir dans la salle');
  });
});

describe('l’écran « À propos »', () => {
  const html = renderToString(<About onClose={() => {}} />);

  it('attribue les sources', () => {
    expect(html).toContain('Lexique');
    expect(html).toContain('Wiktionary');
    expect(html).toContain('CC BY-SA 4.0');
  });

  it('cite la police et la bibliothèque de transport', () => {
    expect(html).toContain('Patrick Hand');
    expect(html).toContain('Trystero');
  });

  it('se ferme', () => {
    expect(html).toContain(LABELS.close);
  });
});
