import { forwardRef } from "react";
import BadgeCard from "./BadgeCard";
import "../badge.css";

/**
 * Composant dédié à la capture (html2canvas).
 * On isole la carte dans un conteneur sans effets de flip/transform 3D
 * pour obtenir un rendu net et fidèle.
 */
const BadgeCapture = forwardRef(function BadgeCapture(
  { membre, branding, face = "recto", qrDataUrl, qrErreur },
  ref
) {
  if (!membre) return null;

  return (
    <div
      ref={ref}
      className="rds-badge-card rds-badge-card--capture"
      style={{
        width: "856px",
        height: "540px",
        aspectRatio: "auto",
        borderRadius: "12px",
        boxShadow: "none",
      }}
    >
      {face === "verso" ? (
        <BadgeCard
          face="verso"
          membre={membre}
          branding={branding}
          qrDataUrl={qrDataUrl}
          qrErreur={qrErreur}
        />
      ) : (
        <BadgeCard
          face="recto"
          membre={membre}
          branding={branding}
          qrDataUrl={qrDataUrl}
          qrErreur={qrErreur}
        />
      )}
    </div>
  );
});

export default BadgeCapture;
