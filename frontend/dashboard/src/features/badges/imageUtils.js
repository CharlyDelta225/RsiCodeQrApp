/**
 * Lecture et compression d'images, entièrement côté navigateur.
 *
 * Les photos et logos sont stockés dans le localStorage : on réduit donc leur
 * poids avant stockage. Aucun fichier n'est envoyé à un serveur.
 */

export function lireFichierDataUrl(fichier) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(String(lecteur.result || ""));
    lecteur.onerror = () => reject(new Error("Lecture du fichier impossible."));
    lecteur.readAsDataURL(fichier);
  });
}

function chargerImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image illisible."));
    image.src = source;
  });
}

/**
 * Compresse une image via un canvas.
 * En cas d'échec (format non supporté par le canvas), renvoie l'original.
 *
 * @param {File} fichier
 * @param {{maxSize?: number, mimeType?: string, quality?: number}} [options]
 * @returns {Promise<string>} data URL
 */
export async function compresserImage(
  fichier,
  { maxSize = 640, mimeType = "image/jpeg", quality = 0.82 } = {}
) {
  const original = await lireFichierDataUrl(fichier);

  if (typeof document === "undefined") return original;

  try {
    const image = await chargerImage(original);
    const plusGrandCote = Math.max(image.width, image.height, 1);
    const ratio = Math.min(1, maxSize / plusGrandCote);
    const largeur = Math.max(1, Math.round(image.width * ratio));
    const hauteur = Math.max(1, Math.round(image.height * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = largeur;
    canvas.height = hauteur;

    const contexte = canvas.getContext("2d");
    if (!contexte) return original;

    // Le JPEG ne gère pas la transparence : on aplatit sur blanc.
    if (mimeType === "image/jpeg") {
      contexte.fillStyle = "#ffffff";
      contexte.fillRect(0, 0, largeur, hauteur);
    }

    contexte.drawImage(image, 0, 0, largeur, hauteur);
    return canvas.toDataURL(mimeType, quality);
  } catch {
    return original;
  }
}
