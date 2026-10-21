import { APP_TAGLINE } from '../text';

/**
 * L'écran d'accueil. Il devient l'écran d'accueil du plan (§4.14) en phase D
 * : « Créer une salle », « Rejoindre », et la reprise d'une salle.
 */
export function Home() {
  return (
    <section className="screen screen--home">
      <p className="muted">{APP_TAGLINE}</p>
    </section>
  );
}
