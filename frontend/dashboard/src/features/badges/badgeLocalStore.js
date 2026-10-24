/**
 * Stockage local (navigateur) des compléments de badge.
 *
 * Tant que le back-end n'expose pas fonction / églises / photo, l'atelier
 * permet de saisir ces informations pour la prévisualisation. Elles restent
 * dans le navigateur (localStorage), ne sont jamais envoyées au serveur et ne
 * modifient aucune donnée existante.
 *
 * Quand le back-end sera prêt, ce fichier pourra être supprimé et remplacé par
 * les champs réels de l'API dans `badgeAdapter.js`.
 */

const OVERRIDES_KEY = "rsi.badge.overrides.v1";
const BRANDING_KEY = "rsi.badge.branding.v1";

function lireJSON(cle, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const brut = window.localStorage.getItem(cle);
    return brut ? JSON.parse(brut) : fallback;
  } catch {
    return fallback;
  }
}

function ecrireJSON(cle, valeur) {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch {
    // Quota dépassé (photo base64 trop lourde) ou stockage désactivé.
    return false;
  }
}

function nettoyerOverrides(overrides = {}) {
  const resultat = {};

  for (const [champ, valeur] of Object.entries(overrides)) {
    if (valeur === undefined) continue;
    // Une chaîne vide est une suppression explicite : on la conserve sous
    // forme de `null` pour que `applyOverrides` masque la valeur de l'API.
    resultat[champ] =
      typeof valeur === "string" && valeur.trim() === "" ? null : valeur;
  }

  return resultat;
}

/** @returns {Record<string, import("./badgeTypes").BadgeOverrides>} */
export function chargerTousOverrides() {
  const donnees = lireJSON(OVERRIDES_KEY, {});
  return donnees && typeof donnees === "object" && !Array.isArray(donnees)
    ? donnees
    : {};
}

/** @returns {import("./badgeTypes").BadgeOverrides} */
export function chargerOverridesMembre(id) {
  if (!id) return {};
  const tous = chargerTousOverrides();
  const valeur = tous[id];
  return valeur && typeof valeur === "object" && !Array.isArray(valeur)
    ? valeur
    : {};
}

/** Enregistre les compléments d'un membre. @returns {boolean} succès du stockage */
export function enregistrerOverridesMembre(id, overrides) {
  if (!id) return false;

  const tous = chargerTousOverrides();
  const propre = nettoyerOverrides(overrides);

  if (Object.keys(propre).length === 0) {
    delete tous[id];
  } else {
    tous[id] = propre;
  }

  return ecrireJSON(OVERRIDES_KEY, tous);
}

export function reinitialiserOverridesMembre(id) {
  if (!id) return;
  const tous = chargerTousOverrides();
  delete tous[id];
  ecrireJSON(OVERRIDES_KEY, tous);
}

/** @returns {import("./badgeTypes").BadgeBranding} */
export function chargerBranding() {
  const donnees = lireJSON(BRANDING_KEY, {});
  return {
    logoUrl:
      donnees && typeof donnees.logoUrl === "string" ? donnees.logoUrl : null,
  };
}

export function enregistrerBranding(branding) {
  return ecrireJSON(BRANDING_KEY, {
    logoUrl:
      branding && typeof branding.logoUrl === "string"
        ? branding.logoUrl
        : null,
  });
}
