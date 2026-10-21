import type { ScreenProps } from '../types';

/** Le Chooser choisit un mot ; les autres attendent. */
export function Pick({ view }: ScreenProps) {
  return (
    <section className="screen screen--pick">
      <h2>Le mot</h2>
      {view.isChooser ? (
        <p>À toi de choisir un mot.</p>
      ) : (
        <p className="muted">Le Chooser choisit un mot…</p>
      )}
    </section>
  );
}
