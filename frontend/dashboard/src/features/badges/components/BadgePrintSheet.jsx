import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import BadgeCard from "./BadgeCard";
import "../badge.css";

const ROOT_ID = "badge-print-root";

const MODES = Object.freeze({
  PLANCHE: "planche",
  CARTE: "carte",
});

/**
 * Feuille d'impression montée en permanence (mais invisible à l'écran).
 * - `planche` : recto + verso côte à côte sur une page A4 ;
 * - `carte`   : deux pages au format ID-1 exact (85,6 × 54 mm).
 *
 * L'impression est déclenchée par la page via `window.print()` ; ce composant
 * ne fait que préparer le DOM imprimable.
 */
export default function BadgePrintSheet({
  membre,
  branding,
  mode = MODES.PLANCHE,
  qrDataUrl,
  qrErreur,
}) {
  const [cible, setCible] = useState(null);

  useEffect(() => {
    let el = document.getElementById(ROOT_ID);
    let cree = false;

    if (!el) {
      el = document.createElement("div");
      el.id = ROOT_ID;
      document.body.appendChild(el);
      cree = true;
    }

    setCible(el);

    return () => {
      if (cree && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    };
  }, []);

  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-badge-print", "true");
    style.textContent = "@page { size: A4 portrait; margin: 8mm; }";
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, []);

  if (!membre || !cible) return null;

  if (mode === MODES.CARTE) {
    return createPortal(
      <div className="rds-print-sheet-carte">
        <div className="rds-print-page">
          <BadgeCard
            face="recto"
            membre={membre}
            branding={branding}
            qrDataUrl={qrDataUrl}
            qrErreur={qrErreur}
          />
        </div>
        <div className="rds-print-page">
          <BadgeCard
            face="verso"
            membre={membre}
            branding={branding}
            qrDataUrl={qrDataUrl}
            qrErreur={qrErreur}
          />
        </div>
      </div>,
      cible
    );
  }

  return createPortal(
    <div className="rds-print-sheet">
      <div className="rds-print-item">
        <span className="rds-print-label">Recto</span>
        <div className="rds-print-crop">
          <BadgeCard
            face="recto"
            membre={membre}
            branding={branding}
            qrDataUrl={qrDataUrl}
            qrErreur={qrErreur}
          />
        </div>
      </div>
      <div className="rds-print-item">
        <span className="rds-print-label">Verso</span>
        <div className="rds-print-crop">
          <BadgeCard
            face="verso"
            membre={membre}
            branding={branding}
            qrDataUrl={qrDataUrl}
            qrErreur={qrErreur}
          />
        </div>
      </div>
    </div>,
    cible
  );
}

export { MODES as BADGE_PRINT_MODES };
