import { normaliserNomDepartement } from "./normaliserDepartement.js";

/** Postes de tous les départements, sauf celui des pasteurs. */
export const POSTES_STANDARD = Object.freeze(["RESPONSABLE", "ADJOINT", "SECRETAIRE", "MEMBRE"]);

/** Postes du département PASTEUR, dans chaque temple. */
export const POSTES_PASTEUR = Object.freeze(["PASTEUR", "PASTEUR_PRINCIPAL", "PASTEUR_RESIDENT", "APOTRE"]);

export function estDepartementPasteur(nom) {
  return ["PASTEUR", "PASTEURS"].includes(normaliserNomDepartement(nom).trim());
}

export const postesDuDepartement = (nom) => (estDepartementPasteur(nom) ? POSTES_PASTEUR : POSTES_STANDARD);

/** Poste donné à l'entrée dans un département quand aucun n'est choisi. */
export const posteParDefaut = (nom) => (estDepartementPasteur(nom) ? "PASTEUR" : "MEMBRE");
