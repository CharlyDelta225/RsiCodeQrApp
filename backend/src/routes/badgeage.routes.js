import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

/**
 * POST /api/badgeage
 *
 * Contrat API (stable — utilisé par le terminal).
 *
 * Body attendu :
 *   { "matricule": "RSI-0001" }
 *
 * Cas de succès (HTTP 200) — badge valide, pointage enregistré :
 *   {
 *     "ok": true,
 *     "ouvrier": {
 *       "id": "...",
 *       "matricule": "RSI-0001",
 *       "nom": "...",
 *       "prenom": "...",
 *       "departement": "..."
 *     }
 *   }
 *
 * Cas d'erreur (HTTP 4xx/5xx) — le badge est inconnu ou désactivé :
 *   { "ok": false, "code": "BADGE_INCONNU",     "message": "Badge inconnu" }
 *   { "ok": false, "code": "BADGE_DESACTIVE",   "message": "Badge désactivé" }
 *   { "ok": false, "code": "MATRICULE_MANQUANT", "message": "Le champ matricule est requis" }
 */
router.post("/", async (req, res) => {
  try {
    const matricule = String(req.body?.matricule ?? "").trim();

    if (!matricule) {
      return res.status(400).json({
        ok: false,
        code: "MATRICULE_MANQUANT",
        message: "Le champ matricule est requis",
      });
    }

    // 1. Recherche de l'ouvrier par son matricule (unique en base)
    const ouvrier = await prisma.ouvrier.findUnique({
      where: { matricule },
    });

    // 2. Badge inconnu => erreur explicite
    if (!ouvrier) {
      return res.status(404).json({
        ok: false,
        code: "BADGE_INCONNU",
        message: "Badge inconnu",
      });
    }

    // 3. Badge désactivé => erreur explicite (fond rouge côté terminal)
    if (!ouvrier.actif) {
      return res.status(403).json({
        ok: false,
        code: "BADGE_DESACTIVE",
        message: "Badge désactivé",
      });
    }

    // 4. Badge valide => on enregistre le pointage (dateHeure = heure serveur)
    //    L'heure vient du serveur, pas du terminal : évite les horloges déréglées.
    await prisma.pointage.create({
      data: {
        ouvrierId: ouvrier.id,
        dateHeure: new Date(),
      },
    });

    // 5. Réponse au terminal : uniquement les infos nécessaires à l'affichage
    return res.status(200).json({
      ok: true,
      ouvrier: {
        id: ouvrier.id,
        matricule: ouvrier.matricule,
        nom: ouvrier.nom,
        prenom: ouvrier.prenom,
        departement: ouvrier.departement,
      },
    });
  } catch (err) {
    console.error("[BADGEAGE]", err);
    return res.status(500).json({
      ok: false,
      code: "ERREUR_INTERNE",
      message: "Une erreur interne est survenue",
    });
  }
});

export default router;