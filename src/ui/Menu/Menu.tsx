import { useEffect, useRef, useState } from 'react';
import { LABELS, MESSAGES } from '../text';

export type MenuProps = {
  /** L'appareil est-il à une table ? Alors quitter demande confirmation. */
  inRoom: boolean;
  /** Quitter la partie et revenir à l'accueil. */
  onHome: () => void;
  /** Ouvrir « À propos ». */
  onAbout: () => void;
};

/**
 * Le menu du coin — le « burger » (§4.14).
 *
 * Il est **toujours là**, mais il ne prend pas la place : c'est un petit
 * bouton, dans la marge, d'où deux entrées — « Accueil », qui libère
 * l'appareil, et « À propos », qui attribue les sources (§10).
 *
 * Quitter une partie en cours est une décision : on demande confirmation,
 * et on ne part qu'ensuite.
 */
export function Menu({ inRoom, onHome, onAbout }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Un clic hors du menu le referme ; la touche Échap aussi.
  //
  // On écoute **pointerdown**, et non click : au moment du click, le bouton
  // pressé peut avoir déjà été remplacé (c'est exactement ce qui arrive
  // quand on presse « Accueil » : le menu se transforme en confirmation),
  // et le test « le clic est-il dehors ? » porterait alors sur un bouton
  // qui n'existe plus — le menu se refermerait, confirmation comprise.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      const node = root.current;
      if (node && !node.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    setOpen((was) => !was);
    setAsking(false);
  };

  /** « Accueil » : on demande, si la partie est en cours. */
  const askHome = () => {
    if (!inRoom) {
      onHome();
      return;
    }
    setAsking(true);
  };

  const leave = () => {
    setAsking(false);
    setOpen(false);
    onHome();
  };

  return (
    <div className="menu" ref={root}>
      <button
        type="button"
        className="btn menu__button"
        aria-label={LABELS.menu}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={toggle}
      >
        ☰
      </button>

      {open ? (
        <div className="menu__panel" role="menu">
          {asking ? (
            <>
              <p className="menu__question">{MESSAGES.leaveConfirm}</p>
              <div className="row">
                <button type="button" className="btn btn--primary btn--small" onClick={leave}>
                  {LABELS.yes}
                </button>
                <button
                  type="button"
                  className="btn btn--quiet btn--small"
                  onClick={() => setAsking(false)}
                >
                  {LABELS.cancel}
                </button>
              </div>
            </>
          ) : (
            <>
              <button type="button" className="menu__item" role="menuitem" onClick={askHome}>
                {LABELS.home}
              </button>
              <button
                type="button"
                className="menu__item"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onAbout();
                }}
              >
                {LABELS.about}
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
