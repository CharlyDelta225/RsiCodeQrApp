import logger from "../lib/logger.js";
import { Router } from "express";
import { declencherRapportsProgrammes } from "../lib/planificateur.js";

const router = Router();

/**
 * GET /api/cron/rapports
 * Déclencheur pour Vercel Cron Job (envoi automatique des rapports à J+1).
 *
 * Vercel Cron envoie une requête GET sur le chemin défini dans `vercel.json`
 * (`crons`). La route est publique (pas de JWT, "less-is-more") mais protégée
 * par un secret partagé `CRON_SECRET` :
 *   Authorization: Bearer <CRON_SECRET>
 * Sans variable CRON_SECRET dans l'environnement, la route est refusée (401).
 *
 * Comportement identique au cron local (server.js, node-cron 06h00) : si la
 * veille était un jour de programme (Mer/Ven/Dim), les PDF par département +
 * récap sont générés et envoyés aux destinataires RAPPORT_EMAIL_DESTINATAIRES.
 *
 * Réponses :
 *   200 { ok, raisons }          — exécution tentée (envoi réussi ou rien à faire)
 *   401 CRON_NON_AUTORISE        — sans secret valide
 *   500 ERREUR_INTERNE
 */
router.get("/rapports", async (req, res) => {
  const attendu = process.env.CRON_SECRET || "";
  const autorisation = String(req.headers.authorization || "").replace(
    /^Bearer\s+/i,
    ""
  );

  if (!attendu || autorisation !== attendu) {
    return res.status(401).json({
      ok: false,
      code: "CRON_NON_AUTORISE",
      message: "Accès refusé : secret invalide",
    });
  }

  try {
    const resultat = await declencherRapportsProgrammes();
    logger.info("[CRON/RAPPORTS]", resultat.ok ? "OK" : "Aucun envoi", resultat.raisons);
    return res.status(200).json({ ok: resultat.ok, raisons: resultat.raisons });
  } catch (err) {
    logger.error("[CRON/RAPPORTS] Erreur", err);
    return res.status(500).json({
      ok: false,
      code: "ERREUR_INTERNE",
      message: "Une erreur interne est survenue",
    });
  }
});

export default router;