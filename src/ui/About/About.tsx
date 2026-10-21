import { APP_TITLE, LABELS } from '../text';

/**
 * « À propos » (§10).
 *
 * L'entrée est obligatoire et visible sur le salon : c'est ici que le jeu
 * attribue ses sources — le pack de mots, la police, et la bibliothèque de
 * transport.
 */
export function About({ onClose }: { onClose: () => void }) {
  return (
    <section className="screen screen--about">
      <h2>{LABELS.about}</h2>

      <p>
        <strong>{APP_TITLE}</strong> — un jeu de bluff de société, sans compte, sans serveur et
        sans publicité. Les téléphones se parlent directement entre eux.
      </p>

      <h3>Mots et définitions</h3>
      <p>
        Les mots viennent du <strong>Lexique</strong> (lexique.org), sous licence de recherche.
        Les définitions viennent du <strong>Wiktionary</strong> français, sous licence
        <strong>CC BY-SA 4.0</strong> : toute redistribution du pack doit conserver cette
        attribution et respecter le partage à l\x27identique.
      </p>

      <h3>Technique</h3>
      <p>
        Le transport pair à pair est <strong>Trystero</strong> (MIT). La police est
        <strong> Patrick Hand</strong> de Patrick Wagesreiter, sous licence SIL Open Font
        License 1.1.
      </p>

      <div className="row">
        <button type="button" className="btn btn--primary" onClick={onClose}>
          {LABELS.close}
        </button>
      </div>
    </section>
  );
}
