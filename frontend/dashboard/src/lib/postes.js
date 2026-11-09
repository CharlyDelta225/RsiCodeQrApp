/** Postes de tous les départements, sauf celui des pasteurs. */
export const POSTES_STANDARD = Object.freeze([
  { valeur: "RESPONSABLE", libelle: "Responsable" },
  { valeur: "ADJOINT", libelle: "Adjoint du responsable" },
  { valeur: "SECRETAIRE", libelle: "Secrétaire" },
  { valeur: "MEMBRE", libelle: "Membre" },
]);

/** Postes du département PASTEUR, dans chaque temple. */
export const POSTES_PASTEUR = Object.freeze([
  { valeur: "PASTEUR", libelle: "PASTEUR" },
  { valeur: "PASTEUR_PRINCIPAL", libelle: "PASTEUR PRINCIPAL" },
  { valeur: "PASTEUR_RESIDENT", libelle: "PASTEUR RESIDENT" },
  { valeur: "APOTRE", libelle: "APÔTRE" },
]);

export const TOUS_LES_POSTES = Object.freeze([...POSTES_STANDARD, ...POSTES_PASTEUR]);

export function estDepartementPasteur(nom) {
  const normalise = String(nom ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toUpperCase();
  return normalise === "PASTEUR" || normalise === "PASTEURS";
}

export const postesDuDepartement = (nom) => (estDepartementPasteur(nom) ? POSTES_PASTEUR : POSTES_STANDARD);

/** Poste présélectionné à l'entrée dans un département. */
export const posteParDefaut = (nom) => (estDepartementPasteur(nom) ? "PASTEUR" : "MEMBRE");

export function libellePoste(valeur) {
  return TOUS_LES_POSTES.find((p) => p.valeur === valeur)?.libelle || valeur || "—";
}
