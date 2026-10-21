import { APP_TITLE, APP_URL, LABELS, PUBLISHER, PUBLISHER_CONTACT, SOURCE_URL } from '../text';

/**
 * « À propos » (§10).
 *
 * L'entrée est obligatoire : c'est ici que le jeu attribue ses sources — le
 * pack de mots, la police, et la bibliothèque de transport — avec les liens
 * de licence. Elle s'ouvre par le menu du coin (§4.14).
 *
 * C'est une feuille qui remonte du bas : elle passe **par-dessus** l'écran du
 * jeu, sans lui laisser de marge ni de place.
 *
 * L'écran porte l'attribution exigée par CC BY-SA 4.0 : les sources, leurs
 * licences, et les **modifications** apportées (adaptation du pack de mots).
 * Le texte intégral de la licence et les notices tierces sont servis **avec**
 * l'application (`/LICENSE.txt`, `/LICENSES.txt`, `/THIRD-PARTY-NOTICES.md`).
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
          par un serveur de jeu. Il se joue en ligne sur{' '}
          <a href={APP_URL} target="_blank" rel="noreferrer noopener">
            jeududictionnaire.fr
          </a>
          .
        </p>

        <h3>Mots et définitions</h3>
        <p>
          Les mots, leurs catégories grammaticales et leurs fréquences viennent du{' '}
          <a href="http://www.lexique.org/" target="_blank" rel="noreferrer noopener">
            Lexique
          </a>{' '}
          (lexique.org), sous licence{' '}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noreferrer noopener"
          >
            CC BY-SA 4.0
          </a>
          . Les définitions viennent du{' '}
          <a
            href="https://fr.wiktionary.org/"
            target="_blank"
            rel="noreferrer noopener"
          >
            Wiktionnaire
          </a>{' '}
          français, sous la même licence.
        </p>
        <p className="muted">
          Le pack de mots est une <strong>adaptation</strong> de ces sources : les formes rares ont
          été sélectionnées, les définitions extraites et nettoyées, l’ensemble reformaté. Toute
          redistribution doit conserver cette attribution et respecter le partage à l’identique.
        </p>

        <h3>Licence</h3>
        <p>
          Le jeu et son code source sont publiés sous licence{' '}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noreferrer noopener"
          >
            CC BY-SA 4.0
          </a>
          . Le texte complet est fourni avec l’application (<code>/LICENSE.txt</code>), ainsi que les
          notices des bibliothèques tierces (<code>/THIRD-PARTY-NOTICES.md</code>) et le détail des
          sources (<code>/LICENSES.txt</code>). Les sources du jeu sont sur{' '}
          <a href={SOURCE_URL} target="_blank" rel="noreferrer noopener">
            GitHub
          </a>
          .
        </p>

        <h3>Technique</h3>
        <p>
          Le transport pair à pair est{' '}
          <a href="https://github.com/dmotz/trystero" target="_blank" rel="noreferrer noopener">
            Trystero
          </a>{' '}
          (MIT). La police est <strong>Patrick Hand</strong> de Patrick Wagesreiter, sous licence
          SIL Open Font License 1.1 : elle est hébergée avec l’application, et son texte de licence
          est fourni avec elle.
        </p>

        <p className="muted">
          Un jeu de {PUBLISHER} — contact : {PUBLISHER_CONTACT}. Hébergeur : GitHub Pages.
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
