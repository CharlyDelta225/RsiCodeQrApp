import prisma from "./prisma.js";

// ==============================
// Temples (églises locales)
//
// Identifiants fixes posés par la migration 20261104120000_temples. Le siège
// (SHALOM) est la valeur par défaut des colonnes egliseId : une écriture qui
// ne précise pas de temple (ancien terminal, scripts, import sans colonne
// « Temple ») reste rattachée au siège.
// ==============================

export const EGLISE_SIEGE_ID = "eglise-shalom";

// Champs renvoyés partout où un temple est affiché.
export const SELECT_EGLISE = Object.freeze({ id: true, code: true, nom: true, estSiege: true });

/**
 * Clé de comparaison d'un temple, insensible à la casse, aux accents, au mot
 * « Temple » et à l'écriture du chiffre : « Temple de 4 CROIX », « 4 croix »,
 * « QUATRE_CROIX » et « quatre-croix » donnent tous « 4CROIX ».
 */
export function cleEglise(valeur) {
  return String(valeur ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\bTEMPLE\b/g, " ")
    .replace(/\b(DE|DU|DES|LA|LE)\b/g, " ")
    .replace(/\bQUATRE\b/g, "4")
    .replace(/\s+/g, "");
}

/**
 * Trouve un temple à partir de son id, de son code ou de son nom (tolérant,
 * voir cleEglise). Renvoie null si rien ne correspond.
 * `eglises` : liste déjà chargée (évite une requête par ligne d'import).
 */
export function trouverEglise(valeur, eglises) {
  const brut = String(valeur ?? "").trim();
  if (!brut) return null;
  const parId = eglises.find((e) => e.id === brut);
  if (parId) return parId;
  const cle = cleEglise(brut);
  if (!cle) return null;
  return eglises.find((e) => cleEglise(e.code) === cle || cleEglise(e.nom) === cle) ?? null;
}

/** Tous les temples (actifs ou non), siège en premier puis par nom. */
export function listerEglises() {
  return prisma.eglise.findMany({ orderBy: [{ estSiege: "desc" }, { nom: "asc" }] });
}

/**
 * Résout le temple demandé dans une requête d'écriture.
 *   - valeur absente / vide → siège (compatibilité)
 *   - valeur inconnue ou temple désactivé → null (l'appelant répond 400)
 */
export async function resoudreEgliseEcriture(valeur) {
  const eglises = await listerEglises();
  const brut = String(valeur ?? "").trim();
  if (!brut) return eglises.find((e) => e.id === EGLISE_SIEGE_ID) ?? eglises.find((e) => e.estSiege) ?? null;
  const eglise = trouverEglise(brut, eglises);
  return eglise && eglise.actif ? eglise : null;
}

export const ERREUR_EGLISE_INCONNUE = Object.freeze({
  ok: false,
  code: "EGLISE_INCONNUE",
  message: "Ce temple n'existe pas ou est désactivé",
});

export const ERREUR_EGLISE_DIFFERENTE = Object.freeze({
  ok: false,
  code: "EGLISE_DIFFERENTE",
  message:
    "Cet ouvrier et ce département n'appartiennent pas au même temple. Transférez d'abord l'ouvrier vers le temple du département.",
});
