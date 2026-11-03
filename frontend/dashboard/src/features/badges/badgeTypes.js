/**
 * Types et constantes du module Badge (front-end uniquement).
 *
 * Le but de ce fichier est de figer le "contrat" entre l'interface et les
 * données : l'adaptateur (`badgeAdapter.js`) produit des `BadgeMember`, les
 * composants ne consomment QUE ce type.
 */

export const BADGE_ORGANISATION = "ROYAUME DE STABILITÉ";
export const BADGE_SOUS_TITRE = "Carte professionnelle";
export const BADGE_DECLARATION = "DÉCLARATION N° 2104/MIS/DGAT/SDVA";
export const BADGE_BANDEAU = "STAFF";
export const BADGE_MENTION_VERSO =
  "Scannez pour vérifier l'identité du titulaire";

/** Format carte d'identité professionnelle (ID-1, carte PVC). */
export const BADGE_FORMAT_ID1 = Object.freeze({
  largeurMm: 85.6,
  hauteurMm: 54,
  ratio: 85.6 / 54,
});

/**
 * @typedef {Object} BadgeMember
 * @property {string} id                 Identifiant technique du membre.
 * @property {string} matricule          Identifiant stable affiché + encodé dans le QR.
 * @property {string} nom                Nom de famille.
 * @property {string} prenom             Prénom(s).
 * @property {string|null} [photoUrl]    Photo (URL http(s) ou data URL locale).
 * @property {string|null} [fonction]    Poste / fonction, si le back-end le fournit.
 * @property {string|null} [departement] Département(s) lisible(s), séparés par des virgules.
 * @property {string|null} [egliseOrigine]  Église / assemblée d'origine, si fournie.
 * @property {string|null} [egliseActuelle] Église / assemblée actuelle, si fournie.
 * @property {string|null} [verificationUrl] URL de vérification, si fournie.
 * @property {boolean} [actif]           Statut du membre.
 *
 * RÈGLE : le téléphone n'est jamais mappé dans `BadgeMember` et ne doit jamais
 * être encodé dans le QR code.
 */
