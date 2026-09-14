import QRCode from "qrcode";
import sharp from "sharp";

/**
 * Génération des PNG de badge (QR code + nom de l'ouvrier en bas de l'image).
 *
 * Le QR encode UNIQUEMENT le matricule (ex : "RSI-0001") : c'est exactement ce
 * que la douchette renvoie au terminal. Le nom affiché sous le QR n'est qu'un
 * habillage pour l'impression — il ne doit JAMAIS être encodé dans le QR, sinon
 * le scan échouerait (BADGE_INCONNU).
 */

export const LARGEUR_BADGE = 600; // largeur du QR = largeur du badge final
const HAUTEUR_BANDE = 132; // bande blanche sous le QR (nom + matricule)
const MARGE_TEXTE = 44; // marge de part et d'autre du texte dans la bande

// Échappe les caractères réservés au XML avant d'embarquer un nom dans le SVG.
function echapperXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Ajuste la taille du nom pour qu'il reste lisible même long :
// 15 caractères ou moins -> grand, jusqu'à 24 -> moyen, au-delà -> compact.
function tailleNom(chaine) {
  const l = chaine.length;
  if (l <= 15) return 46;
  if (l <= 24) return 34;
  return 27;
}

function svgBandeNoms(nomComplet, matricule) {
  const taille = tailleNom(nomComplet);
  const largeurTexte = LARGEUR_BADGE - 2 * MARGE_TEXTE;
  // On contraint la largeur du nom uniquement quand il risque de déborder
  // (long) : les noms courts gardent ainsi leur espacement naturel, les noms
  // très longs sont compressés pour ne jamais sortir de la carte.
  const texte = `<text x="${LARGEUR_BADGE / 2}" y="62" text-anchor="middle" font-family="'Arial', Helvetica, sans-serif" font-size="${taille}" font-weight="bold" fill="#121212"${
    taille === 27 ? ` textLength="${largeurTexte}" lengthAdjust="spacingAndGlyphs"` : ""
  }>${echapperXml(nomComplet)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGEUR_BADGE}" height="${HAUTEUR_BANDE}">
  <rect width="${LARGEUR_BADGE}" height="${HAUTEUR_BANDE}" fill="white"/>
  ${texte}
  <text x="${LARGEUR_BADGE / 2}" y="106" text-anchor="middle" font-family="'Courier New', monospace" font-size="26" fill="#565c62">${echapperXml(matricule)}</text>
</svg>`;
}

/**
 * Construit le PNG complet d'un badge : QR code (600 × 600) puis bande blanche
 * en bas portant « Prénom NOM » et le matricule. Retourne un Buffer PNG prêt à
 * renvoyer (ZIP, aperçu, téléchargement).
 */
export async function genererBadgePng({ nom, prenom, matricule }) {
  const nomComplet = [prenom, nom].filter(Boolean).join(" ");

  const qr = await QRCode.toBuffer(matricule, {
    width: LARGEUR_BADGE,
    margin: 2,
    errorCorrectionLevel: "Q",
  });

  const bande = Buffer.from(svgBandeNoms(nomComplet, matricule));

  const badge = await sharp({
    create: {
      width: LARGEUR_BADGE,
      height: LARGEUR_BADGE + HAUTEUR_BANDE,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      { input: qr, top: 0, left: 0 },
      { input: bande, top: LARGEUR_BADGE, left: 0 },
    ])
    .png()
    .toBuffer();

  return badge;
}