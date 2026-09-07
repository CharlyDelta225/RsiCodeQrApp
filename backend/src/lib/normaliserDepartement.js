/**
 * Normalise un nom de département pour une comparaison INSENSIBLE à la casse
 * ET aux accents : "Média", "MEDIA", "MÉDIA" deviennent tous "MEDIA".
 * Utilisé partout où un nom de département est mis en correspondance
 * (création, renommage, import, rattachement par nom).
 *
 * Le stockage reste le nom propre (ex. "MÉDIA") ; seule la comparaison est
 * normalisée.
 */
export function normaliserNomDepartement(valeur) {
  return String(valeur ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();
}