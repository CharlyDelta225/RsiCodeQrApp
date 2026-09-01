import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

/**
 * GET /api/pointages
 * Historique des badgeages pour le dashboard. Query optionnels :
 *   ?du=YYYY-MM-DD&au=YYYY-MM-DD   filtre par plage de dates
 *   ?ouvrierId=uuid                 filtre par ouvrier
 *   ?page=1&limit=50                pagination (défauts : page 1, limit 50)
 * Réponse : { ok: true, total, page, limit, pointages: [ { id, dateHeure, type, ouvrier: { id, matricule, nom, prenom, departement } } ] }
 */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page ?? "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit ?? "50", 10) || 50));

    const where = {};

    if (req.query.ouvrierId) {
      where.ouvrierId = String(req.query.ouvrierId);
    }

    // Filtre par plage de dates (valides jusqu'à 23:59:59 le jour 'au')
    const du = req.query.du ? new Date(String(req.query.du)) : null;
    const au = req.query.au ? new Date(String(req.query.au)) : null;
    if (du && !isNaN(du)) where.dateHeure = { ...(where.dateHeure ?? {}), gte: du };
    if (au && !isNaN(au)) {
      au.setHours(23, 59, 59, 999);
      where.dateHeure = { ...(where.dateHeure ?? {}), lt: au };
    }

    const [total, pointages] = await Promise.all([
      prisma.pointage.count({ where }),
      prisma.pointage.findMany({
        where,
        orderBy: { dateHeure: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          ouvrier: {
            select: {
              id: true,
              matricule: true,
              nom: true,
              prenom: true,
              departement: true,
            },
          },
        },
      }),
    ]);

    return res.json({ ok: true, total, page, limit, pointages });
  } catch (err) {
    console.error("[POINTAGES/LISTE]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

export default router;