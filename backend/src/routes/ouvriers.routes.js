import logger from "../lib/logger.js";
import { Router } from "express";
import archiver from "archiver";
import prisma from "../lib/prisma.js";
import { genererMatricule, creerAvecMatricule } from "../lib/matricule.js";
import { normaliserNomDepartement } from "../lib/normaliserDepartement.js";
import { genererBadgePng } from "../lib/badge.js";
import { requireRole } from "../middleware/auth.middleware.js";

const router = Router();

// Seuls ADMIN et SUPER_ADMIN peuvent modifier/supprimer des ouvriers.
// La lecture (GET) reste ouverte à tous les rôles authentifiés (dont LECTEUR).
const ECRITURE = requireRole("ADMIN", "SUPER_ADMIN");

// Compare les champs autorisés :
// - sans champ "matricule" => généré automatiquement (création)
// - matricule vide => ignoré (on ne peut pas effacer un matricule)
// - champs extra => silencieusement ignorés (protection contre l'injection de champs)
function extraireChamps(body) {
  const donnees = {};
  if (body.matricule !== undefined) {
    const matricule = String(body.matricule).trim();
    if (matricule) donnees.matricule = matricule;
  }
  if (body.nom !== undefined) donnees.nom = String(body.nom).trim();
  if (body.prenom !== undefined) donnees.prenom = String(body.prenom).trim();
  if (body.photoUrl !== undefined) donnees.photoUrl = String(body.photoUrl).trim() || null;
  if (body.telephone !== undefined) donnees.telephone = String(body.telephone).trim() || null;
  if (body.actif !== undefined) donnees.actif = Boolean(body.actif);
  return donnees;
}

/**
 * GET /api/ouvriers
 * Liste les ouvriers. Query optionnels :
 *   ?actif=true|false     filtre par état
 *   ?recherche=texte      filtre sur nom/prenom/matricule (insensible à la casse)
 *   ?page=1&limit=50      pagination (défauts : page 1, limit 50)
 * Réponse : { ok: true, total, page, limit, ouvriers: [...] }
 */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page ?? "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit ?? "50", 10) || 50));

    const ou = {};
    if (req.query.actif === "true") ou.actif = true;
    if (req.query.actif === "false") ou.actif = false;
    if (req.query.departementId) {
      ou.departements = { some: { departementId: req.query.departementId } };
    }

    const recherche = String(req.query.recherche ?? "").trim();
    if (recherche) {
      ou.OR = [
        { nom: { contains: recherche, mode: "insensitive" } },
        { prenom: { contains: recherche, mode: "insensitive" } },
        { matricule: { contains: recherche, mode: "insensitive" } },
      ];
    }

    const [total, ouvriers] = await Promise.all([
      prisma.ouvrier.count({ where: ou }),
      prisma.ouvrier.findMany({
        where: ou,
        orderBy: [{ nom: "asc" }, { prenom: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          departements: {
            include: { departement: { select: { id: true, nom: true } } },
          },
        },
      }),
    ]);

    return res.json({ ok: true, total, page, limit, ouvriers });
  } catch (err) {
    logger.error("[OUVRIERS/LISTE]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * GET /api/ouvriers/badges/zip
 * Télécharge un ZIP contenant le QR code (PNG) de chaque ouvrier — pour
 * attribuer précisément un badge imprimé à chaque ouvrier avant impression.
 * Query optionnels :
 *   ?actif=true|false     filtre par état (défaut : tous)
 *   ?departementId=uuid   filtre par département (via la table de jonction)
 * Nom de fichier dans le ZIP : "<matricule>_<NOM>_<Prenom>.png"
 * Placée avant "/:id" pour rester lisible, même si aucun conflit de route
 * réel (ce chemin a deux segments, "/:id" et "/:id/badge" n'interceptent
 * jamais "/badges/zip").
 */
router.get("/badges/zip", ECRITURE, async (req, res) => {
  try {
    const ou = {};
    if (req.query.actif === "true") ou.actif = true;
    if (req.query.actif === "false") ou.actif = false;
    if (req.query.departementId) {
      ou.departements = { some: { departementId: req.query.departementId } };
    }

    const ouvriers = await prisma.ouvrier.findMany({ where: ou, orderBy: [{ nom: "asc" }, { prenom: "asc" }] });

    if (ouvriers.length === 0) {
      return res.status(404).json({
        ok: false,
        code: "AUCUN_OUVRIER",
        message: "Aucun ouvrier ne correspond aux filtres fournis",
      });
    }

    // Retire les caractères interdits dans un nom de fichier Windows/Unix
    const nettoyer = (s) => String(s ?? "").replace(/[\\/:*?"<>|]/g, "").trim();

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="badges-qr-${new Date().toISOString().slice(0, 10)}.zip"`
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      logger.error("[OUVRIERS/BADGES_ZIP]", err);
      // Le flux a peut-être déjà commencé : on ne peut plus renvoyer de JSON,
      // on coupe juste la réponse proprement.
      res.end();
    });
    archive.pipe(res);

    for (const o of ouvriers) {
      const png = await genererBadgePng(o);
      const nomFichier = `${nettoyer(o.matricule)}_${nettoyer(o.nom)}_${nettoyer(o.prenom)}.png`;
      archive.append(png, { name: nomFichier });
    }

    await archive.finalize();
  } catch (err) {
    logger.error("[OUVRIERS/BADGES_ZIP]", err);
    if (!res.headersSent) {
      return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
    }
    res.end();
  }
});

/**
 * GET /api/ouvriers/:id
 * Détail d'un ouvrier.
 */
router.get("/:id", async (req, res) => {
  try {
    const ouvrier = await prisma.ouvrier.findUnique({
      where: { id: req.params.id },
      include: {
        departements: {
          include: { departement: { select: { id: true, nom: true } } },
        },
      },
    });
    if (!ouvrier) {
      return res.status(404).json({ ok: false, code: "OUVRIER_INCONNU", message: "Ouvrier introuvable" });
    }
    return res.json({ ok: true, ouvrier });
  } catch (err) {
    logger.error("[OUVRIERS/DETAIL]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * POST /api/ouvriers
 * Crée un ouvrier. Body :
 *   { "nom": "...", "prenom": "...", "departementId": "..."?, "departementNom": "..."?, "photoUrl": "..."?, "actif": true? }
 * Champs requis : nom, prenom.
 * Si departementId ou departementNom est fourni, une liaison OuvrierDepartement est créée (role MEMBRE par défaut).
 * Matricule généré automatiquement si absent.
 */
router.post("/", ECRITURE, async (req, res) => {
  try {
    const { nom, prenom, departementId, departementNom, force } = req.body ?? {};

    if (!nom || !prenom) {
      return res.status(400).json({
        ok: false,
        code: "CHAMPS_MANQUANTS",
        message: "Les champs nom et prenom sont requis",
      });
    }

    const donnees = extraireChamps(req.body);
    if (!donnees.matricule) {
      donnees.matricule = await genererMatricule();
    }

    // Déterminer le département cible (rattachement créé après la création).
    // La correspondance par nom ignore la casse et les accents ("media" → "MÉDIA").
    let departementIdFinal = departementId || null;
    if (!departementIdFinal && departementNom) {
      const departements = await prisma.departement.findMany({
        select: { id: true, nom: true },
      });
      const cible = departements.find(
        (d) =>
          normaliserNomDepartement(d.nom) ===
          normaliserNomDepartement(departementNom)
      );
      if (cible) departementIdFinal = cible.id;
    }

    // Anti doublon (aligné sur l'import) : un ouvrier portant le même nom +
    // prénom déjà rattaché à ce département => refus.
    // Contournement : `force: true` (deux vraies personnes homonymes).
    if (departementIdFinal && !force) {
      const doublon = await prisma.ouvrier.findFirst({
        where: {
          nom: { equals: donnees.nom, mode: "insensitive" },
          prenom: { equals: donnees.prenom, mode: "insensitive" },
          departements: { some: { departementId: departementIdFinal } },
        },
      });
      if (doublon) {
        return res.status(409).json({
          ok: false,
          code: "DOUBLON_DEPARTEMENT",
          message: "Un ouvrier du même nom et prénom existe déjà dans ce département",
        });
      }
    }

    // Créer l'ouvrier. Si le client n'a pas fourni de matricule, on en tire un
    // puis on crée avec retry (collision P2002 gérée dans creerAvecMatricule).
    const ouvrier = donnees.matricule
      ? await prisma.ouvrier.create({ data: donnees })
      : await creerAvecMatricule({ nom: donnees.nom, prenom: donnees.prenom, ...(donnees.photoUrl !== undefined && { photoUrl: donnees.photoUrl }), ...(donnees.actif !== undefined && { actif: donnees.actif }) });

    // Créer la liaison département si fourni
    if (departementIdFinal) {
      await prisma.ouvrierDepartement.create({
        data: {
          ouvrierId: ouvrier.id,
          departementId: departementIdFinal,
          roleDansDepartement: "MEMBRE",
        },
      });
    }

    // Recharger avec les départements
    const ouvrierComplet = await prisma.ouvrier.findUnique({
      where: { id: ouvrier.id },
      include: {
        departements: {
          include: { departement: { select: { id: true, nom: true } } },
        },
      },
    });

    return res.status(201).json({ ok: true, ouvrier: ouvrierComplet });
  } catch (err) {
    // 2002 = unicité violée (matricule déjà pris)
    if (err.code === "P2002") {
      return res.status(409).json({ ok: false, code: "MATRICULE_EXISTANT", message: "Ce matricule existe déjà" });
    }
    logger.error("[OUVRIERS/CREATION]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * PATCH /api/ouvriers/:id
 * Met à jour un ouvrier (tous champs optionnels). Permet de :
 *   - corriger nom / prénom / matricule        ex : { "nom": "..." }
 *   - désactiver/activer un badge              ex : { "actif": false }
 *   - changer le département                   ex : { "departementNom": "MÉDIA" }
 *   - changer de photo                         ex : { "photoUrl": "..." }
 * Si "departementId" ou "departementNom" est fourni (non vide), l'ouvrier est
 * rattaché à CE département précis : la ou les liaisons existantes sont
 * remplacées par une unique liaison (poste MEMBRE).
 */
router.patch("/:id", ECRITURE, async (req, res) => {
  try {
    const donnees = extraireChamps(req.body);

    // Nom / prénom ne peuvent pas redevenir vides (matricule vide, lui, est déjà ignoré).
    if (donnees.nom !== undefined && !donnees.nom) {
      return res.status(400).json({ ok: false, code: "CHAMPS_MANQUANTS", message: "Le nom ne peut pas être vide" });
    }
    if (donnees.prenom !== undefined && !donnees.prenom) {
      return res.status(400).json({ ok: false, code: "CHAMPS_MANQUANTS", message: "Le prénom ne peut pas être vide" });
    }

    const departementIdBrut = req.body.departementId;
    const departementNomBrut = typeof req.body.departementNom === "string" ? String(req.body.departementNom).trim() : "";
    const aDepartement = departementIdBrut !== undefined || departementNomBrut !== "";
    if (Object.keys(donnees).length === 0 && !aDepartement) {
      return res.status(400).json({ ok: false, code: "AUCUNE_DONNEE", message: "Aucune donnée à mettre à jour" });
    }

    const avant = await prisma.ouvrier.findUnique({
      where: { id: req.params.id },
      include: { departements: { select: { departementId: true } } },
    });
    if (!avant) {
      return res.status(404).json({ ok: false, code: "OUVRIER_INCONNU", message: "Ouvrier introuvable" });
    }

    // Résoudre le département cible (id ou nom normalisé).
    let departementIdFinal = null;
    if (aDepartement) {
      if (departementIdBrut) {
        const cible = await prisma.departement.findUnique({ where: { id: departementIdBrut }, select: { id: true } });
        if (!cible) {
          return res.status(400).json({ ok: false, code: "DEPARTEMENT_INCONNU", message: "Ce département n'existe pas" });
        }
        departementIdFinal = cible.id;
      } else {
        const departements = await prisma.departement.findMany({ select: { id: true, nom: true } });
        const cible = departements.find(
          (d) => normaliserNomDepartement(d.nom) === normaliserNomDepartement(departementNomBrut)
        );
        if (!cible) {
          return res.status(400).json({ ok: false, code: "DEPARTEMENT_INCONNU", message: "Ce département n'existe pas" });
        }
        departementIdFinal = cible.id;
      }
    }

    // Anti doublon : même nom + prénom déjà présent dans le département cible
    // (l'homonyme strict est autorisé via force:true, comme à la création).
    if (departementIdFinal && !req.body.force && !avant.departements.some((l) => l.departementId === departementIdFinal)) {
      const nomFinal = donnees.nom !== undefined ? donnees.nom : avant.nom;
      const prenomFinal = donnees.prenom !== undefined ? donnees.prenom : avant.prenom;
      const doublon = await prisma.ouvrier.findFirst({
        where: {
          id: { not: req.params.id },
          nom: { equals: nomFinal, mode: "insensitive" },
          prenom: { equals: prenomFinal, mode: "insensitive" },
          departements: { some: { departementId: departementIdFinal } },
        },
      });
      if (doublon) {
        return res.status(409).json({
          ok: false,
          code: "DOUBLON_DEPARTEMENT",
          message: "Un ouvrier du même nom et prénom existe déjà dans ce département",
        });
      }
    }

    const ouvrier = await prisma.ouvrier.update({
      where: { id: req.params.id },
      data: donnees,
      include: {
        departements: { include: { departement: { select: { id: true, nom: true } } } },
      },
    });

    // Rattachement : on remplace la ou les liaisons par l'unique département
    // demandé (no-op si c'était déjà le seul département de l'ouvrier).
    let departementModifie = false;
    if (departementIdFinal) {
      const seuleDeja = ouvrier.departements.length === 1 && ouvrier.departements[0].departementId === departementIdFinal;
      if (!seuleDeja) {
        await prisma.ouvrierDepartement.deleteMany({ where: { ouvrierId: req.params.id } });
        await prisma.ouvrierDepartement.create({
          data: {
            ouvrierId: req.params.id,
            departementId: departementIdFinal,
            roleDansDepartement: "MEMBRE",
          },
        });
        departementModifie = true;
      }
    }

    // Recharger l'ouvrier si les liaisons ont changé (pour renvoyer l'état réel).
    if (departementModifie) {
      const recharge = await prisma.ouvrier.findUnique({
        where: { id: req.params.id },
        include: {
          departements: { include: { departement: { select: { id: true, nom: true } } } },
        },
      });
      return res.json({ ok: true, ouvrier: recharge });
    }

    return res.json({ ok: true, ouvrier });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ ok: false, code: "OUVRIER_INCONNU", message: "Ouvrier introuvable" });
    }
    if (err.code === "P2002") {
      return res.status(409).json({ ok: false, code: "MATRICULE_EXISTANT", message: "Ce matricule existe déjà" });
    }
    logger.error("[OUVRIERS/MAJ]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * PATCH /api/ouvriers/:id/activer
 * Active un badge (ouvrier). Endpoint dédié et explicite :
 * équivaut à PATCH /api/ouvriers/:id avec { "actif": true }.
 * Réservé à ADMIN/SUPER_ADMIN (middleware ECRITURE).
 */
router.patch("/:id/activer", ECRITURE, async (req, res) => {
  try {
    const ouvrier = await prisma.ouvrier.update({
      where: { id: req.params.id },
      data: { actif: true },
    });
    return res.json({ ok: true, actif: true, ouvrier });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ ok: false, code: "OUVRIER_INCONNU", message: "Ouvrier introuvable" });
    }
    logger.error("[OUVRIERS/ACTIVER]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * PATCH /api/ouvriers/:id/desactiver
 * Désactive un badge (ouvrier) : le badgeage de ce matricule répondra ensuite
 * 403 BADGE_DESACTIVE. Endpoint dédié et explicite.
 * Réservé à ADMIN/SUPER_ADMIN (middleware ECRITURE).
 */
router.patch("/:id/desactiver", ECRITURE, async (req, res) => {
  try {
    const ouvrier = await prisma.ouvrier.update({
      where: { id: req.params.id },
      data: { actif: false },
    });
    return res.json({ ok: true, actif: false, ouvrier });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ ok: false, code: "OUVRIER_INCONNU", message: "Ouvrier introuvable" });
    }
    logger.error("[OUVRIERS/DESACTIVER]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * GET /api/ouvriers/:id/badge
 * Renvoie l'image PNG du QR code du badge de l'ouvrier (à imprimer / prévisualiser).
 */
router.get("/:id/badge", async (req, res) => {
  try {
    const ouvrier = await prisma.ouvrier.findUnique({ where: { id: req.params.id } });
    if (!ouvrier) {
      return res.status(404).json({ ok: false, code: "OUVRIER_INCONNU", message: "Ouvrier introuvable" });
    }

    const png = await genererBadgePng(ouvrier);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(png);
  } catch (err) {
    logger.error("[OUVRIERS/BADGE]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * DELETE /api/ouvriers/:id
 * Supprime un ouvrier et ses pointages (onDelete: Cascade).
 */
router.delete("/:id", ECRITURE, async (req, res) => {
  try {
    await prisma.ouvrier.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ ok: false, code: "OUVRIER_INCONNU", message: "Ouvrier introuvable" });
    }
    logger.error("[OUVRIERS/SUPPRESSION]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

export default router;