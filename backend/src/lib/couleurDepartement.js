import prisma from "./prisma.js";
import { normaliserNomDepartement } from "./normaliserDepartement.js";

/** #RRGGBB vers OKLab, espace où la distance suit la ressemblance perçue par l'œil. */
function versOklab(hex) {
  const lineaire = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r, v, b] = lineaire;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * v + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * v + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * v + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Écart perçu entre deux couleurs #RRGGBB : 0 = identiques. */
export const ecartCouleurs = (a, b) => distance(versOklab(a), versOklab(b));

function tslVersHex(t, s, l) {
  const f = (n) => {
    const k = (n + t / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

// Couleurs possibles pour une bande de carte : le titre y est écrit en or et en
// blanc, donc ni teintes dorées (30-65°), ni couleurs trop claires ou trop sombres.
const CANDIDATES = [];
for (let t = 0; t < 360; t += 5) {
  if (t >= 30 && t <= 65) continue;
  for (const s of [0.6, 0.8, 0.95]) {
    for (const l of [0.24, 0.32, 0.4, 0.48]) {
      const hex = tslVersHex(t, s, l);
      const lab = versOklab(hex);
      if (lab[0] >= 0.3 && lab[0] <= 0.6) CANDIDATES.push({ hex, lab });
    }
  }
}

/** La candidate la plus éloignée de la couleur existante qui lui ressemble le plus. */
export function couleurDistincte(existantes) {
  const labs = existantes.map(versOklab);
  let meilleure = CANDIDATES[0];
  let meilleurEcart = -1;
  for (const c of CANDIDATES) {
    const ecart = Math.min(Infinity, ...labs.map((lab) => distance(c.lab, lab)));
    if (ecart > meilleurEcart) {
      meilleure = c;
      meilleurEcart = ecart;
    }
  }
  return meilleure.hex;
}

/**
 * Couleur d'un département qu'on crée. Un département du même nom dans un autre
 * temple donne sa couleur (un département garde la même couleur partout) ;
 * sinon, une couleur qui ne ressemble à aucune de celles déjà attribuées.
 */
export async function couleurNouveauDepartement(nom) {
  const colores = await prisma.departement.findMany({ where: { couleur: { not: null } }, select: { nom: true, couleur: true } });
  const cle = normaliserNomDepartement(nom).trim();
  const memeNom = colores.find((d) => normaliserNomDepartement(d.nom).trim() === cle);
  return memeNom ? memeNom.couleur : couleurDistincte(colores.map((d) => d.couleur));
}
