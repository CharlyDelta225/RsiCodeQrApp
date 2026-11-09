import logger from "../lib/logger.js";
import { Router } from "express";
import multer from "multer";
import xlsx from "xlsx";
import fs from "node:fs";
import path from "node:path";
import prisma from "../lib/prisma.js";
import { creerAvecMatricule } from "../lib/matricule.js";
import { normaliserNomDepartement } from "../lib/normaliserDepartement.js";
import { posteParDefaut } from "../lib/postesDepartement.js";
import { genererBadgePng } from "../lib/badge.js";
import { requireRole } from "../middleware/auth.middleware.js";
import { listerEglises, trouverEglise, resoudreEgliseEcriture } from "../lib/eglises.js";

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
const COLONNES_ATTENDUES = ["Nom", "Prénom", "Département", "Téléphone"];
// Colonne facultative du temple (SHALOM, ADJAHUI, 4 CROIX…). Sans elle, toutes
// les lignes vont au temple choisi dans l'écran d'import (champ egliseId),
// à défaut au siège.
const COLONNES_TEMPLE = ["Temple", "Église", "Eglise"];

// Générer le fichier QR badge PNG pour un ouvrier.
// Cache disque BEST-EFFORT : les badges sont toujours servis à la volée par
// GET /api/ouvriers/:id/badge (PNG généré en mémoire). Sur un hébergement
// sans FS persistante (Vercel, FS lecture seule), un échec d'écriture ne doit
// PAS faire échouer l'import : on capture et on logge silencieusement.
async function genererBadge(ouvrier) {
  try {
    fs.mkdirSync(BADGES_DIR, { recursive: true });
    const fichier = path.join(BADGES_DIR, `${ouvrier.matricule}.png`);
    fs.writeFileSync(fichier, await genererBadgePng(ouvrier));
  } catch (err) {
    logger.warn(
      `[import] badge (cache disque) non écrit pour ${ouvrier.matricule} : ${err.message}`
    );
  }
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
 *   - Le département doit exister dans le référentiel : sinon tout l'import est
 *     refusé (code DEPARTEMENT_INCONNU) — aucun département n'est créé
 *   - Colonne facultative « Temple » ; sinon champ de formulaire egliseId ; sinon siège
 *   - Le département est cherché DANS le temple de la ligne
 *   - Doublons (nom+prénom+département) : ligne ignorée
 *   - Si l'ouvrier existe déjà dans ce temple (nom+prénom), on ajoute juste la liaison au département
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
    // header: 1 => premier tableau de valeurs ; raw: false => on lit le texte
    // affiché (et non la valeur typée), sinon un téléphone type "0661234567"
    // serait converti en nombre et perdrait son 0 initial.
    const lignesTab = xlsx.utils.sheet_to_json(feuille, { header: 1, raw: false });
    const entete = (lignesTab[0] || []).map((v) => String(v ?? "").trim());
    const lignes = lignesTab.slice(1).filter((l) => l.some((v) => String(v ?? "").trim() !== ""));

    if (lignes.length === 0) {
      throw new AppError(
        "FICHIER_VIDE",
        "Le fichier ne contient aucune donnée. Veuillez vérifier le fichier."
      );
    }

    // Limite du nombre de lignes : évite qu'un fichier gigantesque fasse
    // ramer Prisma (2000 lignes = déjà un import conséquent pour une église).
    const MAX_LIGNES = 2000;
    if (lignes.length > MAX_LIGNES) {
      throw new AppError(
        "TROP_DE_LIGNES",
        `Le fichier contient ${lignes.length} lignes. Le maximum autorisé est de ${MAX_LIGNES}.`
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
    // Le département est normalisé en MAJUSCULES (la table Departement est
    // insensible à la casse : tous les noms sont stockés en majuscules).
    const idx = {
      nom: entete.indexOf("Nom"),
      prenom: entete.indexOf("Prénom"),
      departement: entete.indexOf("Département"),
      telephone: entete.indexOf("Téléphone"),
      temple: entete.findIndex((c) => COLONNES_TEMPLE.includes(c)),
    };

    // Temple par défaut des lignes (champ du formulaire, sinon siège).
    const egliseDefaut = await resoudreEgliseEcriture(req.body?.egliseId);
    if (!egliseDefaut) {
      throw new AppError("EGLISE_INCONNUE", "Le temple choisi pour l'import n'existe pas ou est désactivé.");
    }
    const eglises = await listerEglises();
    const egliseDeLigne = (texte) => {
      if (!texte) return egliseDefaut;
      const e = trouverEglise(texte, eglises);
      return e && e.actif ? e : null;
    };

    const ligneVersObjet = (l) => {
      const templeTexte = idx.temple >= 0 ? String(l[idx.temple] ?? "").trim() : "";
      return {
        nom: String(l[idx.nom] ?? "").trim().toUpperCase(),
        prenom: String(l[idx.prenom] ?? "").trim(),
        departementNom: String(l[idx.departement] ?? "").trim().toUpperCase(),
        telephone: String(l[idx.telephone] ?? "").trim(),
        templeTexte,
        eglise: egliseDeLigne(templeTexte),
      };
    };

    // Temples inconnus : tout l'import est refusé (comme pour les départements).
    const templesInconnus = [
      ...new Set(lignes.map(ligneVersObjet).filter((o) => !o.eglise).map((o) => o.templeTexte)),
    ];
    if (templesInconnus.length > 0) {
      throw new AppError(
        "TEMPLE_INCONNU",
        `Temple(s) inconnu(s) : ${templesInconnus.join(", ")}. Valeurs acceptées : ${eglises
          .filter((e) => e.actif)
          .map((e) => e.nom)
          .join(", ")}.`
      );
    }

    // --- 5-bis. Vérifier que tous les départements du fichier existent dans
    // le référentiel (table Departement). Aucun département n'est créé : si le
    // fichier en contient d'inconnus, tout l'import est refusé.
    // La correspondance est insensible à la casse ET aux accents ("media",
    // "MEDIA", "Média" → tous rattachés au département "MÉDIA"). ---
    // Les départements sont propres à chaque temple : clé = temple + nom normalisé.
    const cleDep = (egliseId, nom) => `${egliseId}|${normaliserNomDepartement(nom)}`;
    const departementsEnBase = await prisma.departement.findMany();
    const departementParCle = new Map(
      departementsEnBase.map((d) => [cleDep(d.egliseId, d.nom), d])
    );
    const introuvables = [
      ...new Set(
        lignes
          .map(ligneVersObjet)
          .filter((o) => o.departementNom !== "" && !departementParCle.has(cleDep(o.eglise.id, o.departementNom)))
          .map((o) => `${o.departementNom} (${o.eglise.nom})`)
      ),
    ];
    if (introuvables.length > 0) {
      throw new AppError(
        "DEPARTEMENT_INCONNU",
        `Département(s) introuvable(s) dans la base : ${introuvables.join(", ")}. Veuillez choisir des départements existants de ce temple.`
      );
    }

    // --- 6. Traitement ligne par ligne ---
    let creees = 0;
    let erreurs = 0;
    const detail = [];

    for (const ligneBrute of lignes) {
      const donnees = ligneVersObjet(ligneBrute);
      const eglise = donnees.eglise;
      const departementCible = departementParCle.get(cleDep(eglise.id, donnees.departementNom));
      // Les champs internes ne vont pas dans le rapport d'import.
      delete donnees.eglise;
      delete donnees.templeTexte;
      donnees.temple = eglise.nom;

      // Validation : tous les champs requis présents
      if (!donnees.nom || !donnees.prenom || !donnees.departementNom || !donnees.telephone) {
        erreurs++;
        detail.push({
          ...donnees,
          statut: "erreur",
          raison: !donnees.nom
            ? "nom manquant"
            : !donnees.prenom
            ? "prénom manquant"
            : !donnees.departementNom
            ? "département manquant"
            : "téléphone manquant",
        });
        continue;
      }

      // Vérifier si l'ouvrier (nom+prénom) existe déjà DANS CE TEMPLE
      const ouvrierExistant = await prisma.ouvrier.findFirst({
        where: {
          egliseId: eglise.id,
          nom: { equals: donnees.nom, mode: "insensitive" },
          prenom: { equals: donnees.prenom, mode: "insensitive" },
        },
      });

      // Si l'ouvrier existe, vérifier s'il est déjà dans ce département
      if (ouvrierExistant) {
        const deptExistant = departementCible;
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
            // Doublon (même Nom+Prénom+Département déjà rattaché en base) :
            // on le remonte comme ligne en erreur pour que le responsable voie
            // qu'il y a un doublon dans le rapport d'import.
            erreurs++;
            detail.push({
              nom: donnees.nom,
              prenom: donnees.prenom,
              departement: donnees.departementNom,
              statut: "erreur",
              raison: "doublon : déjà rattaché à ce département",
            });
            continue;
          }
        }

        // Compléter le téléphone s'il manque et que le fichier en fournit un.
        if (donnees.telephone && !ouvrierExistant.telephone) {
          await prisma.ouvrier.update({
            where: { id: ouvrierExistant.id },
            data: { telephone: donnees.telephone },
          });
        }

        // L'ouvrier existe mais pas dans ce département : on ajoute juste la liaison
        await prisma.ouvrierDepartement.create({
          data: {
            ouvrierId: ouvrierExistant.id,
            departementId: deptExistant.id,
            roleDansDepartement: posteParDefaut(deptExistant.nom),
          },
        });

        // Générer le badge s'il n'en a pas encore (best-effort, cf. genererBadge)
        const BADGES_DIR_RESOLVED = path.resolve(process.cwd(), "public/badges");
        let badgeExiste = false;
        try {
          badgeExiste = fs.existsSync(path.join(BADGES_DIR_RESOLVED, `${ouvrierExistant.matricule}.png`));
        } catch {
          badgeExiste = false;
        }
        if (!badgeExiste) {
          await genererBadge(ouvrierExistant);
        }

        creees++;
        detail.push({
          nom: donnees.nom,
          prenom: donnees.prenom,
          departement: donnees.departementNom,
          temple: eglise.nom,
          matricule: ouvrierExistant.matricule,
          statut: "cree",
        });
        continue;
      }

      // Le département existe (validé en 5-bis) => on ne le crée jamais
      const departement = departementCible;

      // Créer l'ouvrier (matricule auto-généré avec retry sur collision P2002,
      // actif par défaut). Le téléphone est optionnel et normalisé (null si vide).
      const ouvrier = await creerAvecMatricule({
        nom: donnees.nom,
        prenom: donnees.prenom,
        telephone: donnees.telephone || undefined,
        egliseId: eglise.id,
      });

      // Créer la liaison OuvrierDepartement
      await prisma.ouvrierDepartement.create({
        data: {
          ouvrierId: ouvrier.id,
          departementId: departement.id,
          roleDansDepartement: posteParDefaut(departement.nom),
        },
      });

      // Générer le QR badge
      await genererBadge(ouvrier);

      creees++;
      detail.push({
        nom: donnees.nom,
        prenom: donnees.prenom,
        departement: donnees.departementNom,
        temple: eglise.nom,
        matricule: ouvrier.matricule,
        statut: "cree",
      });
    }

    // --- 7. Réponse détaillée ---
    res.json({ ok: true, creees, ignorees: 0, erreurs, detail });
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
