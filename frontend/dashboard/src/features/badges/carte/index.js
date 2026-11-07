/**
 * Point d'entrée du gabarit de carte RSI.
 *
 *   import { genererCarte } from "../features/badges/carte";
 *   const { recto, verso } = await genererCarte({
 *     nom: "COULIBALY", prenom: "DJELIKA VICTOIRE",
 *     fonction: "RESPONSABLE ADJOINTE", matricule: "RSI-9287",
 *     district: "DISTRICT-SIÈGE", departement: "HUISSIER",
 *     couleur: "#BD175C", photo: "data:image/jpeg;base64,…",
 *   });
 *   recto.toBlob(...)  // <canvas> 915 × 1456 px (CR80 portrait, ~430 dpi)
 */
import fondRectoUrl from "./fond-recto.jpg";
import fondMaquetteUrl from "./fond-recto-maquette.png";
import { chargerImage, chargerPolices, dessinerRecto, dessinerVerso } from "./dessinerCarte.js";

const polices = import.meta.glob("/node_modules/@fontsource/poppins/files/poppins-latin-*-*.woff2", {
  query: "?url",
  import: "default",
  eager: true,
});
const urlPolice = (fichier) => polices[`/node_modules/@fontsource/poppins/files/${fichier}`];

let fond = null;
let fondMaquette = null;

export async function preparerGabarit() {
  await chargerPolices(urlPolice);
  fond ??= await chargerImage(fondRectoUrl);
  fondMaquette ??= await chargerImage(fondMaquetteUrl);
  return fond;
}

export async function genererCarte(membre) {
  const image = await preparerGabarit();
  const [recto, verso] = await Promise.all([dessinerRecto({ fond: image, fondMaquette, membre }), dessinerVerso({ membre })]);
  return { recto, verso };
}

export { couleurValide, nomCarte } from "./dessinerCarte.js";
export { COULEUR_MODELE, FONCTION_PAR_ROLE, FORMAT_MM } from "./gabarit.js";
