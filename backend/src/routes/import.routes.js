import { Router } from "express";
import multer from "multer";
import xlsx from "xlsx";
import fs from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import prisma from "../lib/prisma.js";
import { genererMatricule } from "../lib/matricule.js";
import { requireRole } from "../middleware/auth.middleware.js";

const router = Router();

// Classe d'erreur dédiée pour les codes métier (rattrapée par le handler central)
class AppError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// Multer : stocke le fichier en mémoire (pas sur disque) pour traitement immédiat
// Pas de fileFilter ici : on valide l'extension dans la route pour pouvoir renvoyer
// un JSON d'erreur propre (sinon multer appelle next(err) → handler Express).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max
});

// Dossier de sortie des QR codes (même que le script generate-badges.js)
const BADGES_DIR = path.resolve(process.cwd(), "public/badges");

// Colonnes obligatoires attendues dans le fichier (ordre flexible : on cherche par nom)
const COLONNES_ATTENDUES = ["Nom", "Prénom", "Département"];

// Générer le fichier QR badge PNG pour un ouvrier
async function genererBadge(ouvrier) {
  fs.mkdirSync(BADGES_DIR, { recursive: true });
  const fichier = path.join(BADGES_DIR, `${ouvrier.matricule}.png`);
  await QRCode.toFile(fichier, ouvrier.matricule, {
    width: 600,
    margin: 2,
    errorCorrectionLevel: "Q",
    color: { dark: "#1a1a1a", light: "#ffffff" },
  });
}

/**
 * POST /api/ouvriers/import
 * Import massif depuis un fichier .csv ou .xlsx.
 * Protégé par requireAuth + role ADMIN/SUPER_ADMIN (écriture).
 *
 * Body : multipart/form-data — champ "fichier"
 *
 * Validation :
 *   - Extension .csv ou .xlsx uniquement
 *   - Colonnes obligatoires : Nom, Prénom, Département
 *   - Lignes vides ignorées
 *   - Doublons (nom+prénom+département) : ligne ignorée
 *   - Si l'ouvrier existe déjà (nom+prénom), on ajoute juste la liaison au département
 *
 * Réponse : compteur + détail par ligne (créé / ignoré / erreur)
 */
router.post(
  "/import",
  requireRole("ADMIN", "SUPER_ADMIN"),
  upload.single("fichier"),
  async (req, res, next) => {
  try {
    // --- 1. Vérifier qu'un fichier a bien été envoyé ---
    if (!req.file) {
      throw new AppError(
        "FICHIER_MANQUANT",
        "Aucun fichier envoyé. Veuillez sélectionner un fichier .csv ou .xlsx."
      );
    }

    // --- 2. Vérifier l'extension ---
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== ".csv" && ext !== ".xlsx") {
      throw new AppError(
        "TYPE_FICHIER_NON_SUPPORTE",
        "Le type de fichier n'est pas accepté. Seuls les formats .csv et .xlsx sont autorisés."
      );
    }

    // --- 3. Parser le fichier (xlsx gère les deux formats) ---
    // Naturellement, xlsx lit les .csv en codepage 1252 (Latin-1) : un fichier
    // UTF-8 verrait ses accents (é, è...) être affichés "Ã©". Pour un .csv on
    // force donc la lecture en UTF-8 (decoder.stripBOM enlève aussi le BOM).
    let classeur;
    try {
      if (ext === ".csv") {
        const texte = new TextDecoder("utf-8", { fatal: false }).decode(
          req.file.buffer
        );
        classeur = xlsx.read(texte.replace(/^\uFEFF/, ""), { type: "string" });
      } else {
        classeur = xlsx.read(req.file.buffer, { type: "buffer" });
      }
    } catch {
      throw new AppError(
        "FORMAT_INVALIDE",
        "Le fichier est illisible ou corrompu. Veuillez vérifier le fichier."
      );
    }

    // Prendre la première feuille
    const nomFeuille = classeur.SheetNames[0];
    if (!nomFeuille) {
      throw new AppError(
        "FICHIER_VIDE",
        "Le fichier ne contient aucune donnée. Veuillez vérifier le fichier."
      );
    }

    const feuille = classeur.Sheets[nomFeuille];

    // --- 4. Lire l'en-tête (1re ligne en tableau) puis les données (objets) ---
    // /!\ ne PAS valider les colonnes via Object.keys(rows[0]) : une cellule
    // vide dans la première ligne de données ferait disparaître la clé et on
    // croirait à tort une colonne manquante. On lit donc d'abord l'en-tête.
    const lignesTab = xlsx.utils.sheet_to_json(feuille, { header: 1 });
    const entete = (lignesTab[0] || []).map((v) => String(v ?? "").trim());
    const lignes = lignesTab.slice(1).filter((l) => l.some((v) => String(v ?? "").trim() !== ""));

    if (lignes.length === 0) {
      throw new AppError(
        "FICHIER_VIDE",
        "Le fichier ne contient aucune donnée. Veuillez vérifier le fichier."
      );
    }

    // --- 5. Vérifier la présence des colonnes obligatoires dans l'en-tête ---
    const colonnesManquantes = COLONNES_ATTENDUES.filter(
      (c) => !entete.includes(c)
    );

    if (colonnesManquantes.length > 0) {
      throw new AppError(
        "COLONNES_MANQUANTES",
        `Le fichier doit contenir les colonnes : ${COLONNES_ATTENDUES.join(
          ", "
        )}. Colonnes manquantes : ${colonnesManquantes.join(
          ", "
        )}. Veuillez vérifier le fichier.`
      );
    }

    // Construire une fonction "ligne tabulaire → objet {nom, prenom, departementNom}"
    const idx = {
      nom: entete.indexOf("Nom"),
      prenom: entete.indexOf("Prénom"),
      departement: entete.indexOf("Département"),
    };
    const ligneVersObjet = (l) => ({
      nom: String(l[idx.nom] ?? "").trim().toUpperCase(),
      prenom: String(l[idx.prenom] ?? "").trim(),
      departementNom: String(l[idx.departement] ?? "").trim(),
    });

    // --- 6. Traitement ligne par ligne ---
    let creees = 0;
    let ignorees = 0;
    let erreurs = 0;
    const detail = [];

    for (const ligneBrute of lignes) {
      const donnees = ligneVersObjet(ligneBrute);

      // Validation : tous les champs requis présents
      if (!donnees.nom || !donnees.prenom || !donnees.departementNom) {
        erreurs++;
        detail.push({
          ...donnees,
          statut: "erreur",
          raison: !donnees.nom
            ? "nom manquant"
            : !donnees.prenom
            ? "prénom manquant"
            : "département manquant",
        });
        continue;
      }

      // Vérifier si l'ouvrier (nom+prénom) existe déjà
      const ouvrierExistant = await prisma.ouvrier.findFirst({
        where: { nom: donnees.nom, prenom: donnees.prenom },
      });

      // Si l'ouvrier existe, vérifier s'il est déjà dans ce département
      if (ouvrierExistant) {
        const deptExistant = await prisma.departement.findUnique({ where: { nom: donnees.departementNom } });
        if (deptExistant) {
          const liaisonExistante = await prisma.ouvrierDepartement.findUnique({
            where: {
              ouvrierId_departementId: {
                ouvrierId: ouvrierExistant.id,
                departementId: deptExistant.id,
              },
            },
          });
          if (liaisonExistante) {
            ignorees++;
            detail.push({
              nom: donnees.nom,
              prenom: donnees.prenom,
              departement: donnees.departementNom,
              statut: "ignore",
              raison: "doublon",
            });
            continue;
          }
        }

        // L'ouvrier existe mais pas dans ce département : on ajoute juste la liaison
        let dept = deptExistant;
        if (!dept) {
          dept = await prisma.departement.create({ data: { nom: donnees.departementNom } });
        }
        await prisma.ouvrierDepartement.create({
          data: {
            ouvrierId: ouvrierExistant.id,
            departementId: dept.id,
            roleDansDepartement: "MEMBRE",
          },
        });

        // Générer le badge s'il n'en a pas encore
        const BADGES_DIR_RESOLVED = path.resolve(process.cwd(), "public/badges");
        const badgeExiste = fs.existsSync(path.join(BADGES_DIR_RESOLVED, `${ouvrierExistant.matricule}.png`));
        if (!badgeExiste) {
          await genererBadge(ouvrierExistant);
        }

        creees++;
        detail.push({
          nom: donnees.nom,
          prenom: donnees.prenom,
          departement: donnees.departementNom,
          matricule: ouvrierExistant.matricule,
          statut: "cree",
        });
        continue;
      }

      // Créer le département s'il n'existe pas
      let departement = await prisma.departement.findUnique({ where: { nom: donnees.departementNom } });
      if (!departement) {
        departement = await prisma.departement.create({ data: { nom: donnees.departementNom } });
      }

      // Créer l'ouvrier (matricule auto-généré, actif par défaut)
      const matricule = await genererMatricule();
      const ouvrier = await prisma.ouvrier.create({
        data: {
          matricule,
          nom: donnees.nom,
          prenom: donnees.prenom,
        },
      });

      // Créer la liaison OuvrierDepartement
      await prisma.ouvrierDepartement.create({
        data: {
          ouvrierId: ouvrier.id,
          departementId: departement.id,
          roleDansDepartement: "MEMBRE",
        },
      });

      // Générer le QR badge
      await genererBadge(ouvrier);

      creees++;
      detail.push({
        nom: donnees.nom,
        prenom: donnees.prenom,
        departement: donnees.departementNom,
        matricule: ouvrier.matricule,
        statut: "cree",
      });
    }

    // --- 7. Réponse détaillée ---
    res.json({ ok: true, creees, ignorees, erreurs, detail });
  } catch (err) {
    // Les erreurs AppError (validation métier) sont renvoyées telles quelles
    if (err.code && err.status) {
      return res
        .status(err.status)
        .json({ ok: false, code: err.code, message: err.message });
    }
    // Les erreurs inattendues passent au handler central
    next(err);
  }
});

export default router;
