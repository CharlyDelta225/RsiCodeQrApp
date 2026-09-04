import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireRole } from "../middleware/auth.middleware.js";

const router = Router();

const ECRITURE = requireRole("ADMIN", "SUPER_ADMIN");

/**
 * Vérifie qu'un département a au plus un seul RESPONSABLE et un seul ADJOINT.
 * Renvoie une erreur 409 si la contrainte est violée, ou null si tout va bien.
 */
async function verifierUnicitePoste(departementId, role, excludeOuvrierId = null) {
  if (role !== "RESPONSABLE" && role !== "ADJOINT") return null;

  const where = {
    departementId,
    roleDansDepartement: role,
  };
  if (excludeOuvrierId) {
    where.ouvrierId = { not: excludeOuvrierId };
  }

  const existant = await prisma.ouvrierDepartement.findFirst({ where });
  return existant;
}

/**
 * GET /api/departements
 * Liste les départements. Query optionnels :
 *   ?page=1&limit=50   pagination (défauts : page 1, limit 50)
 * Réponse : { ok: true, total, page, limit, departements: [{ id, nom, description, createdAt, _count: { membres } }] }
 */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit ?? "50", 10) || 50));

    const [total, departements] = await Promise.all([
      prisma.departement.count(),
      prisma.departement.findMany({
        orderBy: { nom: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { membres: true } } },
      }),
    ]);

    return res.json({ ok: true, total, page, limit, departements });
  } catch (err) {
    console.error("[DEPARTEMENTS/LISTE]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * GET /api/departements/:id
 * Détail d'un département avec ses membres.
 * Réponse : { ok: true, departement: { id, nom, description, membres: [{ id, ouvrier: {...}, roleDansDepartement }] } }
 */
router.get("/:id", async (req, res) => {
  try {
    const departement = await prisma.departement.findUnique({
      where: { id: req.params.id },
      include: {
        membres: {
          include: { ouvrier: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!departement) {
      return res.status(404).json({ ok: false, code: "DEPARTEMENT_INCONNU", message: "Département introuvable" });
    }

    return res.json({ ok: true, departement });
  } catch (err) {
    console.error("[DEPARTEMENTS/DETAIL]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * GET /api/departements/:id/membres
 * Liste les membres d'un département.
 * Réponse : { ok: true, departement: { id, nom }, membres: [...] }
 */
router.get("/:id/membres", async (req, res) => {
  try {
    const departement = await prisma.departement.findUnique({
      where: { id: req.params.id },
      include: {
        membres: {
          include: { ouvrier: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!departement) {
      return res.status(404).json({ ok: false, code: "DEPARTEMENT_INCONNU", message: "Département introuvable" });
    }

    return res.json({
      ok: true,
      departement: { id: departement.id, nom: departement.nom },
      membres: departement.membres,
    });
  } catch (err) {
    console.error("[DEPARTEMENTS/MEMBRES]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * POST /api/departements
 * Crée un département. Body :
 *   { "nom": "...", "description": "..."? }
 * Champs requis : nom.
 */
router.post("/", ECRITURE, async (req, res) => {
  try {
    const { nom, description } = req.body ?? {};

    if (!nom || !String(nom).trim()) {
      return res.status(400).json({
        ok: false,
        code: "CHAMPS_MANQUANTS",
        message: "Le champ nom est requis",
      });
    }

    const departement = await prisma.departement.create({
      data: {
        nom: String(nom).trim(),
        description: description ? String(description).trim() : null,
      },
    });

    return res.status(201).json({ ok: true, departement });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ ok: false, code: "DEPARTEMENT_EXISTANT", message: "Ce nom de département existe déjà" });
    }
    console.error("[DEPARTEMENTS/CREATION]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * PATCH /api/departements/:id
 * Met à jour un département (tous champs optionnels). Body :
 *   { "nom": "...", "description": "..." }
 */
router.patch("/:id", ECRITURE, async (req, res) => {
  try {
    const donnees = {};
    if (req.body.nom !== undefined) donnees.nom = String(req.body.nom).trim();
    if (req.body.description !== undefined) donnees.description = String(req.body.description).trim() || null;

    if (Object.keys(donnees).length === 0) {
      return res.status(400).json({ ok: false, code: "AUCUNE_DONNEE", message: "Aucune donnée à mettre à jour" });
    }

    const departement = await prisma.departement.update({
      where: { id: req.params.id },
      data: donnees,
    });

    return res.json({ ok: true, departement });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ ok: false, code: "DEPARTEMENT_INCONNU", message: "Département introuvable" });
    }
    if (err.code === "P2002") {
      return res.status(409).json({ ok: false, code: "DEPARTEMENT_EXISTANT", message: "Ce nom de département existe déjà" });
    }
    console.error("[DEPARTEMENTS/MAJ]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * DELETE /api/departements/:id
 * Supprime un département et toutes ses liaisons (onDelete: Cascade).
 */
router.delete("/:id", ECRITURE, async (req, res) => {
  try {
    await prisma.departement.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ ok: false, code: "DEPARTEMENT_INCONNU", message: "Département introuvable" });
    }
    console.error("[DEPARTEMENTS/SUPPRESSION]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * POST /api/departements/:id/membres
 * Ajoute un ouvrier à un département (ou met à jour son poste s'il est déjà membre). Body :
 *   { "ouvrierId": "...", "roleDansDepartement": "MEMBRE" }
 * Champs requis : ouvrierId.
 * La valeur par défaut de roleDansDepartement est MEMBRE.
 * Contrainte : un seul RESPONSABLE et un seul ADJOINT par département.
 */
router.post("/:id/membres", ECRITURE, async (req, res) => {
  try {
    const { ouvrierId, roleDansDepartement = "MEMBRE" } = req.body ?? {};

    if (!ouvrierId) {
      return res.status(400).json({
        ok: false,
        code: "CHAMPS_MANQUANTS",
        message: "Le champ ouvrierId est requis",
      });
    }

    const rolesValides = ["RESPONSABLE", "ADJOINT", "SECRETAIRE", "MEMBRE"];
    if (!rolesValides.includes(roleDansDepartement)) {
      return res.status(400).json({
        ok: false,
        code: "ROLE_INVALIDE",
        message: `Rôle invalide. Valeurs attendues : ${rolesValides.join(", ")}`,
      });
    }

    // Vérifier que le département existe
    const departement = await prisma.departement.findUnique({ where: { id: req.params.id } });
    if (!departement) {
      return res.status(404).json({ ok: false, code: "DEPARTEMENT_INCONNU", message: "Département introuvable" });
    }

    // Vérifier que l'ouvrier existe
    const ouvrier = await prisma.ouvrier.findUnique({ where: { id: ouvrierId } });
    if (!ouvrier) {
      return res.status(404).json({ ok: false, code: "OUVRIER_INCONNU", message: "Ouvrier introuvable" });
    }

    // Vérifier unicité responsable/adjoint (si applicable)
    const doublon = await verifierUnicitePoste(req.params.id, roleDansDepartement, ouvrierId);
    if (doublon) {
      const poste = roleDansDepartement === "RESPONSABLE" ? "responsable" : "adjoint";
      return res.status(409).json({
        ok: false,
        code: "POSTE_DEJA_PRIS",
        message: `Ce département a déjà un ${poste}`,
      });
    }

    // Upsert : si le couple (ouvrierId, departementId) existe déjà, on met à jour le poste
    const liaison = await prisma.ouvrierDepartement.upsert({
      where: {
        ouvrierId_departementId: { ouvrierId, departementId: req.params.id },
      },
      create: {
        ouvrierId,
        departementId: req.params.id,
        roleDansDepartement,
      },
      update: {
        roleDansDepartement,
      },
      include: { ouvrier: true, departement: true },
    });

    return res.status(201).json({ ok: true, liaison });
  } catch (err) {
    console.error("[DEPARTEMENTS/AJOUT_MEMBRE]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * PATCH /api/departements/:id/membres/:ouvrierId
 * Change le poste d'un ouvrier dans un département. Body :
 *   { "roleDansDepartement": "ADJOINT" }
 * Contrainte : un seul RESPONSABLE et un seul ADJOINT par département.
 */
router.patch("/:id/membres/:ouvrierId", ECRITURE, async (req, res) => {
  try {
    const { roleDansDepartement } = req.body ?? {};

    if (!roleDansDepartement) {
      return res.status(400).json({
        ok: false,
        code: "CHAMPS_MANQUANTS",
        message: "Le champ roleDansDepartement est requis",
      });
    }

    const rolesValides = ["RESPONSABLE", "ADJOINT", "SECRETAIRE", "MEMBRE"];
    if (!rolesValides.includes(roleDansDepartement)) {
      return res.status(400).json({
        ok: false,
        code: "ROLE_INVALIDE",
        message: `Rôle invalide. Valeurs attendues : ${rolesValides.join(", ")}`,
      });
    }

    const departement = await prisma.departement.findUnique({ where: { id: req.params.id } });
    if (!departement) {
      return res.status(404).json({ ok: false, code: "DEPARTEMENT_INCONNU", message: "Département introuvable" });
    }

    // Vérifier que la liaison existe
    const liaisonExistante = await prisma.ouvrierDepartement.findUnique({
      where: {
        ouvrierId_departementId: { ouvrierId: req.params.ouvrierId, departementId: req.params.id },
      },
    });
    if (!liaisonExistante) {
      return res.status(404).json({
        ok: false,
        code: "MEMBRE_INCONNU",
        message: "Cet ouvrier n'est pas membre de ce département",
      });
    }

    // Vérifier unicité responsable/adjoint (si applicable)
    const doublon = await verifierUnicitePoste(req.params.id, roleDansDepartement, req.params.ouvrierId);
    if (doublon) {
      const poste = roleDansDepartement === "RESPONSABLE" ? "responsable" : "adjoint";
      return res.status(409).json({
        ok: false,
        code: "POSTE_DEJA_PRIS",
        message: `Ce département a déjà un ${poste}`,
      });
    }

    const liaison = await prisma.ouvrierDepartement.update({
      where: { id: liaisonExistante.id },
      data: { roleDansDepartement },
      include: { ouvrier: true, departement: true },
    });

    return res.json({ ok: true, liaison });
  } catch (err) {
    console.error("[DEPARTEMENTS/CHANGER_POSTE]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * DELETE /api/departements/:id/membres/:ouvrierId
 * Retire un ouvrier d'un département.
 */
router.delete("/:id/membres/:ouvrierId", ECRITURE, async (req, res) => {
  try {
    const departement = await prisma.departement.findUnique({ where: { id: req.params.id } });
    if (!departement) {
      return res.status(404).json({ ok: false, code: "DEPARTEMENT_INCONNU", message: "Département introuvable" });
    }

    const liaisonExistante = await prisma.ouvrierDepartement.findUnique({
      where: {
        ouvrierId_departementId: { ouvrierId: req.params.ouvrierId, departementId: req.params.id },
      },
    });
    if (!liaisonExistante) {
      return res.status(404).json({
        ok: false,
        code: "MEMBRE_INCONNU",
        message: "Cet ouvrier n'est pas membre de ce département",
      });
    }

    await prisma.ouvrierDepartement.delete({ where: { id: liaisonExistante.id } });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[DEPARTEMENTS/SUPPRIMER_MEMBRE]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

export default router;
