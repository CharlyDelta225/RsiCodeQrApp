/**
 * Retourne le(s) département(s) d'un ouvrier sous forme de chaîne lisible.
 * Compatible avec la relation many-to-many (schema Prisma actuel).
 */
export function libelleDepartement(ouvrier) {
  if (!ouvrier) return "—";

  // Ancien format (si un jour un champ string revient)
  if (typeof ouvrier.departement === "string" && ouvrier.departement.trim()) {
    return ouvrier.departement.trim();
  }

  // Nouveau format : relation OuvrierDepartement[]
  const liste = ouvrier.departements;
  if (Array.isArray(liste) && liste.length > 0) {
    const noms = liste
      .map((l) => l?.departement?.nom)
      .filter(Boolean);
    if (noms.length > 0) return noms.join(", ");
  }

  return "—";
}