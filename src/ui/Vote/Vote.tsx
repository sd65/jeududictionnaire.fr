import type { ScreenProps } from '../types';

/** Le bulletin : des numéros en mode vocal, des définitions en mode normal. */
export function Vote({ view }: ScreenProps) {
  return (
    <section className="screen screen--vote">
      <h2>Le vote</h2>
      <ol className="ballot">
        {Array.from({ length: view.optionsCount }, (_, index) => (
          <li key={index} className={index === view.myIdx ? 'ballot__own' : undefined}>
            {view.showTexts ? (view.options[index] ?? '') : `définition n°${index + 1}`}
          </li>
        ))}
      </ol>
    </section>
  );
}
