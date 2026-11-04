import { PHOTO } from "./gabarit.js";

/**
 * Prépare une photo pour la carte : recadrée au format du cadre (358 × 438),
 * redimensionnée (2× pour l'impression) et compressée en JPEG (~100 Ko).
 * Le recadrage garde le centre horizontal et remonte un peu vers le visage.
 */
export async function preparerPhoto(fichier) {
  if (!/^image\/(jpeg|png|webp)$/.test(fichier.type)) {
    throw new Error("Choisissez une photo JPG, PNG ou WebP.");
  }
  const url = URL.createObjectURL(fichier);
  try {
    const img = await new Promise((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ko(new Error("Cette image ne peut pas être lue."));
      i.src = url;
    });
    const largeur = PHOTO.l * 2;
    const hauteur = PHOTO.h * 2;
    const ratio = largeur / hauteur;
    let sl = img.naturalWidth;
    let sh = sl / ratio;
    if (sh > img.naturalHeight) {
      sh = img.naturalHeight;
      sl = sh * ratio;
    }
    const sx = (img.naturalWidth - sl) / 2;
    const sy = Math.max(0, (img.naturalHeight - sh) * 0.3);
    const canvas = document.createElement("canvas");
    canvas.width = largeur;
    canvas.height = hauteur;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, largeur, hauteur);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sl, sh, 0, 0, largeur, hauteur);
    for (const qualite of [0.9, 0.8, 0.7]) {
      const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", qualite));
      if (blob && blob.size < 900 * 1024) return blob;
    }
    throw new Error("La photo reste trop lourde après compression.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
