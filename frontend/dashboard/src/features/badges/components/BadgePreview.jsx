import BadgeCard from "./BadgeCard";
import "../badge.css";

const ONGLETS = [
  { face: "recto", label: "Recto" },
  { face: "verso", label: "Verso" },
];

/**
 * Aperçu interactif recto / verso avec bascule animée.
 * `face` et `onFaceChange` sont contrôlés par la page pour synchroniser
 * l'aperçu et les commandes d'impression.
 */
export default function BadgePreview({
  membre,
  branding,
  face = "recto",
  onFaceChange,
  qrDataUrl,
  qrErreur,
}) {
  return (
    <div className="space-y-3">
      <div className="rds-flip-stage">
        <div
          className={`rds-flip-inner ${face === "verso" ? "est-verso" : ""}`}
        >
          <div className="rds-flip-face" aria-hidden={face !== "recto"}>
            <BadgeCard
              face="recto"
              membre={membre}
              branding={branding}
              qrDataUrl={qrDataUrl}
              qrErreur={qrErreur}
            />
          </div>
          <div
            className="rds-flip-face face-verso"
            aria-hidden={face !== "verso"}
          >
            <BadgeCard
              face="verso"
              membre={membre}
              branding={branding}
              qrDataUrl={qrDataUrl}
              qrErreur={qrErreur}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="inline-flex rounded-full border border-slate-300 bg-slate-50 p-0.5"
          role="tablist"
          aria-label="Face du badge"
        >
          {ONGLETS.map((onglet) => {
            const actif = face === onglet.face;
            return (
              <button
                key={onglet.face}
                type="button"
                role="tab"
                aria-selected={actif}
                onClick={() => onFaceChange?.(onglet.face)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  actif
                    ? "bg-white text-bordeaux-800 shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                {onglet.label}
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-500">
          Format ID-1 · 85,6 × 54 mm
        </p>
      </div>
    </div>
  );
}
