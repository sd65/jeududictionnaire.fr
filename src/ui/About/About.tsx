import { APP_TITLE, LABELS } from '../text';

/**
 * « À propos » (§10).
 *
 * L'entrée est obligatoire : c'est ici que le jeu attribue ses sources — le
 * pack de mots, la police, et la bibliothèque de transport — avec les liens
 * de licence. Elle s'ouvre par le menu du coin (§4.14).
 *
 * C'est une feuille qui remonte du bas : elle passe **par-dessus** l'écran du
 * jeu, sans lui laisser de marge ni de place.
 */
export function About({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay">
      <section
        className="overlay__panel screen--about"
        role="dialog"
        aria-modal="true"
        aria-label={LABELS.about}
      >
        <h2>{LABELS.about}</h2>

        <p>
          <strong>{APP_TITLE}</strong> — un jeu de bluff de société, sans compte, sans serveur et
          sans publicité. Les téléphones se parlent directement entre eux : aucun joueur ne passe
          par un serveur de jeu.
        </p>

        <h3>Mots et définitions</h3>
        <p>
          Les mots et leurs fréquences viennent du{' '}
          <a href="https://www.lexique.org/" target="_blank" rel="noreferrer noopener">
            Lexique
          </a>{' '}
          (lexique.org), sous licence de recherche. Les définitions viennent du{' '}
          <a
            href="https://fr.wiktionary.org/"
            target="_blank"
            rel="noreferrer noopener"
          >
            Wiktionary
          </a>{' '}
          français, sous licence{' '}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noreferrer noopener"
          >
            CC BY-SA 4.0
          </a>
          .
        </p>
        <p className="muted">
          Le pack de mots est une adaptation conforme de ces sources : toute redistribution doit
          conserver cette attribution et respecter le partage à l’identique.
        </p>

        <h3>Technique</h3>
        <p>
          Le transport pair à pair est{' '}
          <a href="https://github.com/dmotz/trystero" target="_blank" rel="noreferrer noopener">
            Trystero
          </a>{' '}
          (MIT). La police est <strong>Patrick Hand</strong> de Patrick Wagesreiter, sous licence
          SIL Open Font License 1.1 : elle est hébergée avec l’application, et son texte de
          licence est fourni avec elle.
        </p>

        <div className="row">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            {LABELS.close}
          </button>
        </div>
      </section>
    </div>
  );
}
