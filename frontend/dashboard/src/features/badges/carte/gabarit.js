/**
 * Gabarit de la carte de badge RSI.
 *
 * Fond de toutes les cartes : `fond-recto-maquette.png`, la maquette originale
 * (carte ACCUEIL, bande bleue) agrandie à 915 × 1456 px (format CR80 portrait
 * 54 × 85,6 mm, soit environ 430 dpi), recolorée selon le département.
 * `fond-recto.jpg` (ancienne maquette HUISSIER) ne sert plus que de secours.
 * Le verso utilise le même espace.
 *
 * Éléments FIXES (dans l'image de fond) : dégradé, portrait en filigrane,
 * sceau, logo, « ROYAUME DE STABILITE », déclaration, cadre de la photo,
 * trait doré, « N° Matricule: », bande du bas et le mot « Département ».
 *
 * Éléments DYNAMIQUES (dessinés par-dessus) : photo, nom et prénoms,
 * fonction, matricule, district, nom du département, couleur du département.
 */

export const LARGEUR = 915;
export const HAUTEUR = 1456;
export const FORMAT_MM = Object.freeze({ largeur: 54, hauteur: 85.6 });

/** Couleur de la bande du modèle (département HUISSIER). Sert de référence au recoloriage. */
export const COULEUR_MODELE = "#BD175C";

/**
 * Couleur de la bande de la maquette de référence (`fond-recto-maquette.png`,
 * carte ACCUEIL) : base du recoloriage de toutes les cartes.
 */
export const COULEUR_FOND_MAQUETTE = "#0269A3";

export const POLICE = '"Poppins RSI", "Poppins", "Segoe UI", sans-serif';

/** Cadre photo : intérieur du liseré orangé/doré. */
export const PHOTO = Object.freeze({ x: 280, y: 312, l: 358, h: 438 });

/** Zones protégées du recoloriage (leurs couleurs ne dépendent pas du département). */
export const ZONES_PROTEGEES = Object.freeze({
  logo: { cx: 157.5, cy: 126.5, r: 88 }, // disque du logo (au-delà : halo du fond, recoloré)
  cadre: { x: 267, y: 300, l: 379, h: 459 }, // liseré du cadre photo (l'intérieur est recouvert par la photo)
  traitDore: { x: 150, y: 880, l: 620, h: 32 }, // trait doré sous le nom
  titreDore: { x: 230, y: 112, l: 590, h: 108 }, // « STABILITE » doré de l'en-tête
});

const CENTRE = LARGEUR / 2;

/**
 * Textes dynamiques du recto. `base` = ligne de base ; `hauteurCap` = hauteur
 * des capitales mesurée sur la maquette ; `largeurMax` = largeur au-delà de
 * laquelle le texte est réduit pour tenir sur une ligne.
 */
export const TEXTES = Object.freeze({
  nom: { x: CENTRE, base: 867, hauteurCap: 38, poids: 800, style: "normal", espacement: 0.9, couleur: "#050203", largeurMax: 840 },
  fonction: { x: CENTRE, base: 970, hauteurCap: 42, poids: 400, style: "normal", espacement: 1.6, couleur: "#050203", largeurMax: 820 },
  matricule: { x: CENTRE, base: 1108, hauteurCap: 48, poids: 800, style: "normal", espacement: 2, couleur: "#CC1C0B", largeurMax: 760 },
  district: { x: CENTRE + 4, base: 1164, hauteurCap: 38, poids: 600, style: "italic", couleur: "#C6231A", largeurMax: 820 },
  departement: { x: CENTRE + 2, base: 1406, hauteurCap: 103, poids: 900, style: "italic", largeurMax: 800,
    // Nom trop long pour une ligne lisible : deux lignes plus petites.
    deuxLignes: { seuil: 0.62, hauteurCap: 56, bases: [1360, 1428] } },
});

/**
 * Textes des cartes faites sur la maquette de référence (tous les départements) : mesurés sur la carte originale « KOUASSI LOUKOU
 * CHRISTELLE / ACCUEIL ». Nom serré, fonction en 500, matricule sans
 * espacement, nom du département plus grand.
 */
export const TEXTES_MAQUETTE = Object.freeze({
  ...TEXTES,
  nom: { ...TEXTES.nom, base: 871, hauteurCap: 41, espacement: -1.8 },
  fonction: { ...TEXTES.fonction, base: 968, poids: 500 },
  matricule: { ...TEXTES.matricule, espacement: -0.5 },
  district: { ...TEXTES.district, x: CENTRE - 1, base: 1162, hauteurCap: 36, espacement: 1.3 },
  departement: { ...TEXTES.departement, x: CENTRE + 8, hauteurCap: 114, espacement: -3.6 },
});

/**
 * Mention à écrire par-dessus une créa importée. La créa porte déjà
 * « Département » et le nom du département, mais pas « N° Matricule: ».
 */
export const MENTIONS_CREA = Object.freeze({
  matricule: { texte: "N° Matricule:", x: CENTRE + 1, base: 1031, hauteurCap: 36, poids: 500, style: "normal", couleur: "#050203", largeurMax: 420 },
});

/**
 * Variante « titre seul » (modèle PASTEUR) : pas de mot « Département », une
 * bande en dégradé un peu plus basse, et le titre seul, centré dans la bande.
 * Mesures relevées sur la carte « PASTEUR » (même échelle que le modèle).
 */
export const TITRE_SEUL = Object.freeze({
  // Bande d'origine : liseré clair à 1172-1175, bord à 1176. La bande pasteur commence à 1198.
  bandeOrigine: 1172,
  ligneFond: 1171,
  lisere: 6,
  bande: 1198,
  // Dégradé de la bande : couleur du département en haut, plus claire et un peu plus cyan vers le bas.
  degrade: [
    [0, 0, 0],
    [0.24, -2, 0.035],
    [0.47, -5, 0.085],
    [0.69, -6, 0.1],
    [1, -6, 0.085],
  ],
  titre: { x: CENTRE + 2, base: 1382, hauteurCap: 114, poids: 900, style: "italic", largeurMax: 830 },
  // Le matricule et le district sont un peu plus bas que sur le modèle « Département ».
  decalages: { matricule: 7, district: 14 },
});

/** Dégradé métallique du nom du département (relevé sur « HUISSIER »). */
export const OR_DEPARTEMENT = Object.freeze([
  [0, "#E9AE2C"],
  [0.16, "#F8DC78"],
  [0.33, "#F1C246"],
  [0.5, "#FCEC98"],
  [0.67, "#F2C448"],
  [0.84, "#F9DE76"],
  [1, "#E6A422"],
]);

/** Verso : QR, nom, matricule et encadré de texte. */
export const VERSO = Object.freeze({
  qr: { x: 272.5, y: 298.3, taille: 368.6 },
  // Sur la maquette ces deux lignes sont illisibles (police manquante) ; ici en Poppins.
  nom: { x: CENTRE, base: 747, taille: 17, poids: 600, couleur: "#222222" },
  matricule: { x: CENTRE, base: 780, taille: 15, poids: 500, couleur: "#555555" },
  cadre: { x: 88, y: 930, l: 739, h: 276, trait: 2.9 },
  // La taille est calée pour que la 1re ligne mesure `largeurLigne1` px, comme sur la maquette.
  texte: { x: 110.4, base: 992.6, interligne: 33.27, largeurLigne1: 693, poids: 400, couleur: "#111111" },
  lignes: [
    "Cette carte est strictement personnelle Elle atteste",
    "de l'engagement de son titulaire au sein de",
    "la communauté de l'Église ROYAUME DE STABILITÉ.",
    "En cas de perte, veuillez contacter le secrétariat",
    "au 05 04 61 81 78. Merci de rapporter ce badge",
    "au secrétariat si vous le trouvez.",
  ],
});

/** Libellé de fonction par défaut, selon le rôle dans le département. */
export const FONCTION_PAR_ROLE = Object.freeze({
  RESPONSABLE: "RESPONSABLE",
  ADJOINT: "RESPONSABLE ADJOINT",
  SECRETAIRE: "SECRÉTAIRE",
  MEMBRE: "MEMBRE",
});

/** Polices utilisées (chargées explicitement : le canvas ne les déclenche pas seul). */
export const VARIANTES_POLICE = Object.freeze([
  { poids: 400, style: "normal", fichier: "poppins-latin-400-normal.woff2" },
  { poids: 500, style: "normal", fichier: "poppins-latin-500-normal.woff2" },
  { poids: 600, style: "normal", fichier: "poppins-latin-600-normal.woff2" },
  { poids: 600, style: "italic", fichier: "poppins-latin-600-italic.woff2" },
  { poids: 800, style: "normal", fichier: "poppins-latin-800-normal.woff2" },
  { poids: 900, style: "italic", fichier: "poppins-latin-900-italic.woff2" },
]);
