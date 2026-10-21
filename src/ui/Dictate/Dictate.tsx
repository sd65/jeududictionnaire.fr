import type { ScreenProps } from '../types';

/** Le Chooser lit les définitions à voix haute. */
export function Dictate({ view }: ScreenProps) {
  return (
    <section className="screen screen--dictate">
      <h2>La dictée</h2>
      {view.isChooser ? (
        <p>Dictes les définitions à voix haute, une par une.</p>
      ) : (
        <p className="muted">Écoute, et retiens.</p>
      )}
    </section>
  );
}
