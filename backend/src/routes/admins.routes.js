import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireRole } from "../middleware/auth.middleware.js";

const router = Router();

// Gestion des comptes admin : réservé au SUPER_ADMIN.
const SUPER_SEULEMENT = requireRole("SUPER_ADMIN");

/**
 * GET /api/admins
 * Liste tous les comptes admin (pour la gestion des rôles côté dashboard).
 * Réservé au SUPER_ADMIN.
 */
router.get("/", SUPER_SEULEMENT, async (_req, res) => {
  try {
    const admins = await prisma.admin.findMany({
      select: { id: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return res.json({ ok: true, admins });
  } catch (err) {
    console.error("[ADMINS/LISTE]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * PATCH /api/admins/:id/role
 * Change le rôle d'un compte admin. Réservé au SUPER_ADMIN.
 * Body : { "role": "ADMIN" | "LECTEUR" | "SUPER_ADMIN" }
 *
 * Garde-fou : un SUPER_ADMIN ne peut PAS se rétrograder lui-même (ni se
 * changer son propre rôle). Cela évite de se couper l'accès accidentellement.
 */
router.patch("/:id/role", SUPER_SEULEMENT, async (req, res) => {
  try {
    const role = String(req.body?.role ?? "").toUpperCase();
    if (!["ADMIN", "LECTEUR", "SUPER_ADMIN"].includes(role)) {
      return res.status(400).json({ ok: false, code: "ROLE_INVALIDE", message: "Le rôle doit être ADMIN, LECTEUR ou SUPER_ADMIN" });
    }

    const cible = await prisma.admin.findUnique({ where: { id: req.params.id } });
    if (!cible) {
      return res.status(404).json({ ok: false, code: "ADMIN_INCONNU", message: "Compte admin introuvable" });
    }

    // AUTO-RÉTROGRADATION BLOQUÉE : empêcher de se modifier soi-même.
    if (cible.id === req.admin.id) {
      return res.status(403).json({ ok: false, code: "ACTION_IMPOSSIBLE", message: "Vous ne pouvez pas modifier votre propre rôle" });
    }

    const admin = await prisma.admin.update({
      where: { id: cible.id },
      data: { role },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    return res.json({ ok: true, admin });
  } catch (err) {
    console.error("[ADMINS/ROLE]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

export default router;
