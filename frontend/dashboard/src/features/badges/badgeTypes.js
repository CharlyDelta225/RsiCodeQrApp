/**
 * Types et constantes du module Badge (front-end uniquement).
 *
 * Le but de ce fichier est de figer le "contrat" entre l'interface et les
 * données : l'adaptateur (`badgeAdapter.js`) produit des `BadgeMember`, les
 * composants ne consomment QUE ce type. Le développeur back-end peut donc
 * brancher ses API en modifiant l'adaptateur, sans toucher aux composants.
 */

export const BADGE_ORGANISATION = "ROYAUME DE STABILITÉ";
export const BADGE_SOUS_TITRE = "Carte professionnelle";
export const BADGE_MENTION_STAFF = "STAFF";
export const BADGE_MENTION_VERSO =
  "Scannez pour vérifier l'identité du titulaire";

/** Format carte d'identité professionnelle (ID-1, carte PVC). */
export const BADGE_FORMAT_ID1 = Object.freeze({
  largeurMm: 85.6,
  hauteurMm: 54,
  ratio: 85.6 / 54,
});

export const BADGE_SOURCES = Object.freeze({
  DEMO: "demo",
  API: "api",
});

/**
 * @typedef {Object} BadgeMember
 * @property {string} id                 Identifiant technique du membre.
 * @property {string} matricule          Identifiant stable affiché + encodé dans le QR.
 * @property {string} nom                Nom de famille.
 * @property {string} prenom             Prénom(s).
 * @property {string|null} [photoUrl]    Photo (URL http(s) ou data URL locale).
 * @property {string|null} [fonction]    Poste / fonction (ex. Pasteur, Responsable).
 * @property {string|null} [departement] Département(s) lisible(s), séparés par des virgules.
 * @property {string|null} [egliseOrigine]  Église / assemblée d'origine.
 * @property {string|null} [egliseActuelle] Église / assemblée actuelle.
 * @property {string|null} [verificationUrl] URL de vérification fournie plus tard par le back-end.
 * @property {boolean} [actif]           Statut du membre.
 * @property {"api"|"demo"} [source]     Provenance de la donnée.
 *
 * RÈGLE : le téléphone n'est jamais mappé dans `BadgeMember` et ne doit jamais
 * être encodé dans le QR code.
 */

/**
 * @typedef {Object} BadgeBranding
 * @property {string|null} [logoUrl] Logo personnalisé (data URL ou URL d'image).
 */

/**
 * @typedef {Object} BadgeOverrides
 * @property {string|null} [photoUrl]
 * @property {string|null} [fonction]
 * @property {string|null} [departement]
 * @property {string|null} [egliseOrigine]
 * @property {string|null} [egliseActuelle]
 * @property {string|null} [verificationUrl]
 */
