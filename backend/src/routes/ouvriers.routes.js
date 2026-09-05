import { Router } from "express";
import QRCode from "qrcode";
import archiver from "archiver";
import prisma from "../lib/prisma.js";
import { genererMatricule } from "../lib/matricule.js";
import { requireRole } from "../middleware/auth.middleware.js";

const router = Router();

// Seuls ADMIN et SUPER_ADMIN peuvent modifier/supprimer des ouvriers.
// La lecture (GET) reste ouverte à tous les rôles authentifiés (dont LECTEUR).
const ECRITURE = requireRole("ADMIN", "SUPER_ADMIN");

// Compare les champs autorisés :
// - sans champ "matricule" => généré automatiquement
// - champs extra => silencieusement ignorés (protection contre l'injection de champs)
function extraireChamps(body) {
  const donnees = {};
  if (body.matricule !== undefined) donnees.matricule = String(body.matricule).trim();
  if (body.nom !== undefined) donnees.nom = String(body.nom).trim();
  if (body.prenom !== undefined) donnees.prenom = String(body.prenom).trim();
  if (body.photoUrl !== undefined) donnees.photoUrl = String(body.photoUrl).trim() || null;
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
        orderBy: { nom: "asc" },
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
    console.error("[OUVRIERS/LISTE]", err);
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
router.get("/badges/zip", async (req, res) => {
  try {
    const ou = {};
    if (req.query.actif === "true") ou.actif = true;
    if (req.query.actif === "false") ou.actif = false;
    if (req.query.departementId) {
      ou.departements = { some: { departementId: req.query.departementId } };
    }

    const ouvriers = await prisma.ouvrier.findMany({ where: ou, orderBy: { nom: "asc" } });

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
      console.error("[OUVRIERS/BADGES_ZIP]", err);
      // Le flux a peut-être déjà commencé : on ne peut plus renvoyer de JSON,
      // on coupe juste la réponse proprement.
      res.end();
    });
    archive.pipe(res);

    for (const o of ouvriers) {
      const png = await QRCode.toBuffer(o.matricule, {
        width: 600,
        margin: 2,
        errorCorrectionLevel: "Q",
      });
      const nomFichier = `${nettoyer(o.matricule)}_${nettoyer(o.nom)}_${nettoyer(o.prenom)}.png`;
      archive.append(png, { name: nomFichier });
    }

    await archive.finalize();
  } catch (err) {
    console.error("[OUVRIERS/BADGES_ZIP]", err);
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
    console.error("[OUVRIERS/DETAIL]", err);
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

    // Déterminer le département cible (rattachement créé après la création)
    let departementIdFinal = departementId || null;
    if (!departementIdFinal && departementNom) {
      const dept = await prisma.departement.findUnique({ where: { nom: String(departementNom).trim() } });
      if (dept) departementIdFinal = dept.id;
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

    // Créer l'ouvrier
    const ouvrier = await prisma.ouvrier.create({ data: donnees });

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
    console.error("[OUVRIERS/CREATION]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * PATCH /api/ouvriers/:id
 * Met à jour un ouvrier (tous champs optionnels). Permet de désactiver un badge : { "actif": false }.
 */
router.patch("/:id", ECRITURE, async (req, res) => {
  try {
    const donnees = extraireChamps(req.body);
    if (Object.keys(donnees).length === 0) {
      return res.status(400).json({ ok: false, code: "AUCUNE_DONNEE", message: "Aucune donnée à mettre à jour" });
    }

    const ouvrier = await prisma.ouvrier.update({
      where: { id: req.params.id },
      data: donnees,
      include: {
        departements: {
          include: { departement: { select: { id: true, nom: true } } },
        },
      },
    });
    return res.json({ ok: true, ouvrier });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ ok: false, code: "OUVRIER_INCONNU", message: "Ouvrier introuvable" });
    }
    if (err.code === "P2002") {
      return res.status(409).json({ ok: false, code: "MATRICULE_EXISTANT", message: "Ce matricule existe déjà" });
    }
    console.error("[OUVRIERS/MAJ]", err);
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
    console.error("[OUVRIERS/ACTIVER]", err);
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
    console.error("[OUVRIERS/DESACTIVER]", err);
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

    const png = await QRCode.toBuffer(ouvrier.matricule, {
      width: 600,
      margin: 2,
      errorCorrectionLevel: "Q",
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(png);
  } catch (err) {
    console.error("[OUVRIERS/BADGE]", err);
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
    console.error("[OUVRIERS/SUPPRESSION]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

export default router;