import logger from "../lib/logger.js";
import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireRole } from "../middleware/auth.middleware.js";

const router = Router();

// Plafond de `limit` : un jour compte au plus un pointage par ouvrier, donc
// 2000 couvre largement une journée ; le champ `total` signale un dépassement.
const LIMITE_MAX = 2000;
// Bornes de l'export CSV et des statistiques (protège la fonction serverless).
const EXPORT_MAX_LIGNES = 50000;
const STATS_JOURS_MAX = 90;

const SELECT_OUVRIER = {
  id: true,
  matricule: true,
  nom: true,
  prenom: true,
  departements: {
    select: { departement: { select: { id: true, nom: true } } },
  },
};

// Filtres communs (liste, export) : ?du, ?au (inclus jusqu'à 23:59:59), ?ouvrierId
function filtresPointages(query) {
  const where = {};
  if (query.ouvrierId) where.ouvrierId = String(query.ouvrierId);

  const du = query.du ? new Date(String(query.du)) : null;
  const au = query.au ? new Date(String(query.au)) : null;
  if (du && !isNaN(du)) where.dateHeure = { ...(where.dateHeure ?? {}), gte: du };
  if (au && !isNaN(au)) {
    au.setHours(23, 59, 59, 999);
    where.dateHeure = { ...(where.dateHeure ?? {}), lt: au };
  }

  // ?jourSemaine=0..6 (0 = dimanche) : appliqué en base, donc à la pagination
  // et à l'export entiers (et non à la seule page affichée). Exige du et au :
  // on liste les jours civils de la période qui tombent ce jour-là.
  const js = query.jourSemaine;
  if (js !== undefined && js !== "" && /^[0-6]$/.test(String(js)) && du && au && !isNaN(du) && !isNaN(au)) {
    const jours = [];
    const d = new Date(`${String(query.du)}T00:00:00.000Z`);
    const fin = new Date(`${String(query.au)}T00:00:00.000Z`);
    for (let n = 0; d <= fin && n < 3700; n++) {
      if (d.getUTCDay() === Number(js)) jours.push(new Date(d));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    where.jour = { in: jours };
  }
  return where;
}

// ?ordre=date → du plus récent au plus ancien (historique) ;
// par défaut → alphabétique par ouvrier (pointages du jour).
function triPointages(ordre) {
  return ordre === "date"
    ? [{ dateHeure: "desc" }]
    : [{ ouvrier: { nom: "asc" } }, { ouvrier: { prenom: "asc" } }];
}

/**
 * GET /api/pointages
 * Historique des badgeages pour le dashboard. Query optionnels :
 *   ?du=YYYY-MM-DD&au=YYYY-MM-DD   filtre par plage de dates
 *   ?ouvrierId=uuid                 filtre par ouvrier
 *   ?jourSemaine=0..6               seulement ce jour de la semaine (0 = dimanche ; avec du et au)
 *   ?ordre=date                     tri du plus récent au plus ancien (défaut : par nom)
 *   ?page=1&limit=50                pagination (défauts : page 1, limit 50, max 2000)
 * Réponse : { ok: true, total, page, limit, pointages: [ { id, dateHeure, type, ouvrier: { id, matricule, nom, prenom, departements: [...] } } ] }
 */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page ?? "1", 10) || 1);
    const limit = Math.min(LIMITE_MAX, Math.max(1, parseInt(req.query.limit ?? "50", 10) || 50));
    const where = filtresPointages(req.query);

    const [total, pointages] = await Promise.all([
      prisma.pointage.count({ where }),
      prisma.pointage.findMany({
        where,
        orderBy: triPointages(req.query.ordre),
        skip: (page - 1) * limit,
        take: limit,
        include: { ouvrier: { select: SELECT_OUVRIER } },
      }),
    ]);

    return res.json({ ok: true, total, page, limit, pointages });
  } catch (err) {
    logger.error("[POINTAGES/LISTE]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * GET /api/pointages/stats?jours=7
 * Indicateurs du tableau de bord, calculés en base (aucune troncature) :
 * {
 *   ok, jour,                                   // jour courant (UTC, AAAA-MM-JJ)
 *   ouvriers: { total, actifs, desactives },
 *   departements,                               // nombre de départements
 *   presentsAuj,                                // ouvriers ayant badgé aujourd'hui
 *   parJour: [{ date: "AAAA-MM-JJ", presents }],// `jours` derniers jours (1 à 90)
 *   pointagesAuj: [...]                         // pointages du jour (1 max par ouvrier)
 * }
 */
router.get("/stats", async (req, res) => {
  try {
    const jours = Math.min(STATS_JOURS_MAX, Math.max(1, parseInt(req.query.jours ?? "7", 10) || 7));

    // Jour civil UTC, comme la colonne `jour` remplie au badgeage.
    const aujISO = new Date().toISOString().slice(0, 10);
    const auj = new Date(`${aujISO}T00:00:00.000Z`);
    const debut = new Date(auj);
    debut.setUTCDate(debut.getUTCDate() - (jours - 1));

    const [total, actifs, departements, groupes, pointagesAuj] = await Promise.all([
      prisma.ouvrier.count(),
      prisma.ouvrier.count({ where: { actif: true } }),
      prisma.departement.count(),
      prisma.pointage.groupBy({
        by: ["jour"],
        where: { jour: { gte: debut, lte: auj } },
        _count: { _all: true },
      }),
      prisma.pointage.findMany({
        where: { jour: auj },
        orderBy: { dateHeure: "asc" },
        include: { ouvrier: { select: SELECT_OUVRIER } },
      }),
    ]);

    const parDate = new Map(
      groupes.map((g) => [g.jour.toISOString().slice(0, 10), g._count._all])
    );
    const parJour = [];
    for (let i = 0; i < jours; i++) {
      const d = new Date(debut);
      d.setUTCDate(d.getUTCDate() + i);
      const iso = d.toISOString().slice(0, 10);
      parJour.push({ date: iso, presents: parDate.get(iso) ?? 0 });
    }

    return res.json({
      ok: true,
      jour: aujISO,
      ouvriers: { total, actifs, desactives: total - actifs },
      departements,
      presentsAuj: pointagesAuj.length,
      parJour,
      pointagesAuj,
    });
  } catch (err) {
    logger.error("[POINTAGES/STATS]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

function csvValeur(v) {
  const s = String(v ?? "");
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * GET /api/pointages/export?du=YYYY-MM-DD&au=YYYY-MM-DD[&ouvrierId=uuid]
 * PROTÉGÉ : ADMIN ou SUPER_ADMIN (un LECTEUR consulte, il n'extrait pas).
 * CSV (séparateur « ; », UTF-8 avec BOM pour Excel) de TOUTE la période
 * filtrée, du plus récent au plus ancien — pas seulement la page affichée.
 * Erreur : 413 EXPORT_TROP_GROS au-delà de 50 000 lignes (réduire la période).
 */
router.get("/export", requireRole("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const where = filtresPointages(req.query);
    const total = await prisma.pointage.count({ where });
    if (total > EXPORT_MAX_LIGNES) {
      return res.status(413).json({
        ok: false,
        code: "EXPORT_TROP_GROS",
        message: `Trop de lignes (${total}). Réduisez la période (maximum ${EXPORT_MAX_LIGNES}).`,
      });
    }

    const pointages = await prisma.pointage.findMany({
      where,
      orderBy: [{ dateHeure: "desc" }],
      include: { ouvrier: { select: SELECT_OUVRIER } },
    });

    const entete = ["Date", "Heure", "Matricule", "Nom", "Prénom", "Département(s)"];
    const lignes = pointages.map((p) => {
      const d = new Date(p.dateHeure);
      return [
        d.toISOString().slice(0, 10),
        d.toISOString().slice(11, 16),
        p.ouvrier?.matricule,
        p.ouvrier?.nom,
        p.ouvrier?.prenom,
        (p.ouvrier?.departements ?? []).map((l) => l.departement?.nom).filter(Boolean).join(", "),
      ]
        .map(csvValeur)
        .join(";");
    });

    // Nom de fichier : seulement chiffres et tirets (aucune injection d'en-tête).
    const du = String(req.query.du ?? "").replace(/[^0-9-]/g, "") || "debut";
    const au = String(req.query.au ?? "").replace(/[^0-9-]/g, "") || "fin";
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="historique-pointages_${du}_a_${au}.csv"`
    );
    return res.send("﻿" + [entete.join(";"), ...lignes].join("\r\n"));
  } catch (err) {
    logger.error("[POINTAGES/EXPORT]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

export default router;
