import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const TAILLES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

const FOCUSABLES =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Pile des fenêtres ouvertes : seule la plus récente (au-dessus) réagit au clavier.
// Indispensable quand une confirmation s'ouvre par-dessus une fenêtre d'édition.
const pile = [];
let nbOuvertes = 0;
let overflowAvant = "";

/**
 * Fenêtre modale accessible (dialog).
 * - role="dialog" + aria-modal + aria-labelledby (titre)
 * - Échap ferme, clic sur le fond ferme (désactivable)
 * - le focus est piégé dans la fenêtre puis rendu à l'élément d'origine
 * - le défilement de la page est bloqué tant qu'une fenêtre est ouverte
 * - plusieurs fenêtres peuvent être empilées : la dernière ouverte est au-dessus
 *   et seule elle réagit à Échap / Tab
 *
 * Usage (rendu conditionnel, recommandé quand le contenu lit un objet nullable) :
 *   {edition && (
 *     <Modal titre="Modifier" onClose={() => setEdition(null)}>
 *       <form className="p-6 space-y-4">…</form>
 *     </Modal>
 *   )}
 *
 * `ouvert` est optionnel (true par défaut).
 * `bloquee` (ex. pendant un envoi) désactive Échap, le fond et le bouton fermer.
 * `labelledBy` : id d'un titre déjà présent dans le contenu (si `titre` est omis).
 */
export default function Modal({
  ouvert = true,
  titre,
  labelledBy,
  onClose,
  taille = "md",
  bloquee = false,
  fermerSurFond = true,
  children,
}) {
  const idTitre = useId();
  const panneauRef = useRef(null);
  // Évite de relancer l'effet (et de voler le focus) à chaque rendu parent.
  const onCloseRef = useRef(onClose);
  const bloqueeRef = useRef(bloquee);
  onCloseRef.current = onClose;
  bloqueeRef.current = bloquee;

  useEffect(() => {
    if (!ouvert) return undefined;

    const jeton = {};
    pile.push(jeton);
    const precedent = document.activeElement;
    const panneau = panneauRef.current;

    const premier = panneau?.querySelector("[autofocus], input, select, textarea") || panneau?.querySelector(FOCUSABLES);
    (premier || panneau)?.focus();

    if (nbOuvertes === 0) overflowAvant = document.body.style.overflow;
    nbOuvertes += 1;
    document.body.style.overflow = "hidden";

    function surClavier(e) {
      if (pile[pile.length - 1] !== jeton) return;
      if (e.key === "Escape") {
        if (!bloqueeRef.current) {
          e.stopPropagation();
          onCloseRef.current?.();
        }
        return;
      }
      if (e.key !== "Tab" || !panneau) return;
      const items = Array.from(panneau.querySelectorAll(FOCUSABLES)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        panneau.focus();
        return;
      }
      const debut = items[0];
      const fin = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === debut || document.activeElement === panneau)) {
        e.preventDefault();
        fin.focus();
      } else if (!e.shiftKey && document.activeElement === fin) {
        e.preventDefault();
        debut.focus();
      }
    }

    document.addEventListener("keydown", surClavier);
    return () => {
      document.removeEventListener("keydown", surClavier);
      const i = pile.indexOf(jeton);
      if (i !== -1) pile.splice(i, 1);
      nbOuvertes -= 1;
      if (nbOuvertes <= 0) {
        nbOuvertes = 0;
        document.body.style.overflow = overflowAvant;
      }
      if (precedent && typeof precedent.focus === "function") precedent.focus();
    };
  }, [ouvert]);

  if (!ouvert) return null;

  function surFond(e) {
    if (e.target === e.currentTarget && fermerSurFond && !bloquee) onClose?.();
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onMouseDown={surFond}
    >
      <div
        ref={panneauRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titre ? idTitre : labelledBy}
        tabIndex={-1}
        className={`bg-white rounded-2xl shadow-2xl w-full ${TAILLES[taille] || TAILLES.md} max-h-[90vh] overflow-y-auto focus:outline-none`}
      >
        {titre && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 id={idTitre} className="font-semibold text-slate-800 text-sm" style={{ fontFamily: "Poppins,sans-serif" }}>
              {titre}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={bloquee}
              aria-label="Fermer la fenêtre"
              className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}