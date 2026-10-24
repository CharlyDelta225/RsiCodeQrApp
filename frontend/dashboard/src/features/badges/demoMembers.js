/**
 * DONNÉES DE DÉMONSTRATION — strictement séparées des données réelles.
 *
 * Ce fichier ne sert qu'à prévisualiser l'atelier badge sans backend.
 * - Aucun téléphone n'est présent (il ne doit jamais figurer sur le badge).
 * - Aucune donnée n'est inventée à partir de l'API : ce sont des exemples
 *   explicitement identifiés par `source: "demo"`.
 * - Pour brancher les vraies données, utiliser `badgeService.js` (source API).
 *
 * @type {import("./badgeTypes").BadgeMember[]}
 */
export const DEMO_MEMBERS = [
  {
    id: "demo-rds-001",
    matricule: "RDS-0001",
    nom: "KOUAME",
    prenom: "Aya",
    photoUrl: null,
    fonction: "Pasteur",
    departement: "Louange",
    egliseOrigine: "Assemblée Bethel",
    egliseActuelle: "Assemblée Bethel",
    verificationUrl: null,
    actif: true,
    source: "demo",
  },
  {
    id: "demo-rds-002",
    matricule: "RDS-0002",
    nom: "BAMBA",
    prenom: "Ibrahim",
    photoUrl: null,
    fonction: "Responsable accueil",
    departement: "Accueil",
    egliseOrigine: "Assemblée Bethel",
    egliseActuelle: "Assemblée Eben-Ezer",
    verificationUrl: null,
    actif: true,
    source: "demo",
  },
  {
    id: "demo-rds-003",
    matricule: "RDS-0003",
    nom: "N'GUESSAN",
    prenom: "Marie",
    photoUrl: null,
    fonction: "Membre",
    departement: "Intercession et suivi des familles",
    egliseOrigine: "Assemblée Eben-Ezer",
    egliseActuelle: null,
    verificationUrl: null,
    actif: true,
    source: "demo",
  },
];
