import { APP_TAGLINE, APP_TITLE } from './ui/text';

/**
 * Coquille de l'application. Les écrans réels arrivent en phase D
 * (PLAN.md §12.8) : le choix de l'écran se fera alors sur la phase du jeu.
 */
export function App() {
  return (
    <main className="app">
      <h1 className="app__title">{APP_TITLE}</h1>
      <p className="app__tagline">{APP_TAGLINE}</p>
    </main>
  );
}
