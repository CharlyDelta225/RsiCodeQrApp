import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Génère un QR code côté navigateur (aucun appel serveur).
 *
 * La valeur encodée est fournie par `valeurQr()` : toujours le matricule,
 * seul format lu par le terminal de badgeage.
 *
 * Le téléphone n'est jamais transmis à ce hook.
 */
export function useBadgeQr(valeur) {
  const [dataUrl, setDataUrl] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let annule = false;

    // On efface le QR précédent dès que la cible change, pour ne jamais
    // imprimer par erreur le QR d'un autre membre.
    setDataUrl(null);
    setErreur(null);

    if (!valeur) {
      return undefined;
    }

    QRCode.toDataURL(String(valeur), {
      errorCorrectionLevel: "Q",
      margin: 2,
      width: 640,
      color: {
        dark: "#0B0B0B",
        light: "#FFFFFF",
      },
    })
      .then((url) => {
        if (annule) return;
        setDataUrl(url);
      })
      .catch((err) => {
        if (annule) return;
        setErreur(err);
      });

    return () => {
      annule = true;
    };
  }, [valeur]);

  return { dataUrl, erreur };
}
