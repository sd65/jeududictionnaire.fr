import type { ScreenProps } from '../types';

/** Le mot est diffusé, et chacun écrit sa fausse définition. */
export function Draft({ view }: ScreenProps) {
  return (
    <section className="screen screen--draft">
      <h2>Le mot : {view.word}</h2>
      <p className="muted">Écris une fausse définition.</p>
      <p>
        {view.submitted.length} / {view.expectedWriters.length} ont envoyé la leur.
      </p>
    </section>
  );
}
