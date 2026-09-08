import { Router } from "express";
import { requireRole } from "../middleware/auth.middleware.js";
import {
  construireRapport,
  genererPdfsRapport,
  envoyerRapportEmail,
  smtpConfigure,
  corpsRapport,
} from "../lib/rapport.js";

const router = Router();

/** Parse une date AAAA-MM-JJ (défaut : aujourd'hui). Retourne null si illisible. */
function dateDepuisParam(nonRenseigne) {
  const brut = String(nonRenseigne ?? "").trim();
  const date = brut === "" ? new Date() : new Date(`${brut}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * GET /api/rapports/journalier
 * PROTÉGÉ (JWT admin requis — lecture, accessible à tout rôle).
 *
 * Retourne la structure du rapport d'une date (présence calculée selon les
 * mêmes règles que la route POST : seuil si jour de programme, "badgé =
 * présent" sinon). Sert la page Rapport du dashboard (filtre + affichage).
 *
 * Query :
 *   ?date=2026-09-09     date (défaut : aujourd'hui)
 *   ?departementId=<id>  filtre sur un département (défaut : tous) — le
 *                        récapitulatif est recalculé sur la sélection.
 *
 * Succès (HTTP 200) :
 *   { ok, rapport: {
 *       dateISO, dateLongueur, jourLabel, seuilTexte, notePresence, programme,
 *       departements: [{ id, nom, presents, absents, effectif,
 *                        lignes: [{ matricule, nom, prenom, present, heure }] }],
 *       recap: { presents, absents, effectif }
 *     } }
 *
 * Erreurs :
 *   - 400 DATE_INVALIDE        : date illisible
 *   - 404 DEPARTEMENT_INCONNU  : departementId inconnu
 */
router.get("/journalier", async (req, res) => {
  try {
    const date = dateDepuisParam(req.query?.date);
    if (!date) {
      return res.status(400).json({
        ok: false,
        code: "DATE_INVALIDE",
        message: "Date invalide. Format attendu : AAAA-MM-JJ",
      });
    }

    const structure = await construireRapport(date);

    const departementId = String(req.query?.departementId ?? "").trim();
    if (departementId !== "") {
      const dep = structure.departements.find((d) => d.id === departementId);
      if (!dep) {
        return res.status(404).json({
          ok: false,
          code: "DEPARTEMENT_INCONNU",
          message: "Département introuvable",
        });
      }
      structure.departements = [dep];
      structure.recap = {
        presents: dep.presents,
        absents: dep.absents,
        effectif: dep.effectif,
      };
    }

    return res.json({ ok: true, rapport: structure });
  } catch (err) {
    console.error("[RAPPORTS/LECTURE]", err);
    return res.status(500).json({
      ok: false,
      code: "ERREUR_INTERNE",
      message: "Une erreur interne est survenue",
    });
  }
});

/**
 * POST /api/rapports/journalier
 * PROTÉGÉ (JWT admin requis, rôle ADMIN ou SUPER_ADMIN).
 *
 * Génère les PDF (un par département + récapitulatif) de la date passée en
 * paramètre (défaut : aujourd'hui) et les envoie par email.
 *
 * Sur un jour de programme (Mer/Ven/Dim) : présent si badge ≤ seuil
 * (Mercredi/Vendredi 21h30, Dimanche 12h00).
 * Sur tout autre jour : présent si un badge a été effectué (peu importe
 * l'heure) — la route manuelle fonctionne n'importe quel jour.
 *
 * Body optionnel :
 *   { "date": "2026-09-09",          // AAAA-MM-JJ (défaut : aujourd'hui)
 *     "destinataires": ["a@x.fr"] }  // surcharge RAPPORT_EMAIL_DESTINATAIRES
 *
 * Succès (HTTP 200) :
 *   { ok, rapport: {...}, email: { destinataires, messageId } }
 *
 * Erreurs :
 *   - 400 DATE_INVALIDE         : date illisible
 *   - 400 SMTP_NON_CONFIGURE    : SMTP_HOST absent du .env
 *   - 400 SANS_DESTINATAIRE     : ni paramètre ni RAPPORT_EMAIL_DESTINATAIRES
 *   - 400 ENVOI_EMAIL_ECHOUE    : l'envoi SMTP a échoué
 *   - 500 ERREUR_INTERNE
 */
router.post(
  "/journalier",
  requireRole("ADMIN", "SUPER_ADMIN"),
  async (req, res) => {
  try {
    const date = dateDepuisParam(req.body?.date);
    if (!date) {
      return res.status(400).json({
        ok: false,
        code: "DATE_INVALIDE",
        message: "Date invalide. Format attendu : AAAA-MM-JJ",
      });
    }

    const structure = await construireRapport(date);

    if (!smtpConfigure()) {
      return res.status(400).json({
        ok: false,
        code: "SMTP_NON_CONFIGURE",
        message:
          "Envoi email non configuré : renseignez SMTP_HOST (et SMTP_USER/SMTP_PASS) dans le .env.",
      });
    }

    // Destinataires : paramètre de requête OU variable d'environnement.
    const destsDemandes = Array.isArray(req.body?.destinataires)
      ? req.body.destinataires.map((d) => String(d).trim()).filter(Boolean)
      : [];
    const dests =
      destsDemandes.length > 0
        ? destsDemandes
        : (process.env.RAPPORT_EMAIL_DESTINATAIRES || "")
            .split(",")
            .map((d) => d.trim())
            .filter(Boolean);

    if (dests.length === 0) {
      return res.status(400).json({
        ok: false,
        code: "SANS_DESTINATAIRE",
        message:
          "Aucun destinataire : passez-les dans la requête ou renseignez RAPPORT_EMAIL_DESTINATAIRES dans le .env.",
      });
    }

    const piecesJointes = await genererPdfsRapport(structure);

    try {
      const { messageId } = await envoyerRapportEmail({
        dests,
        objet: `Rapport de pointage — ${structure.jourLabel} ${structure.dateLongueur}`,
        corps: corpsRapport(structure),
        piecesJointes,
      });

      // Nettoie en arrière-plan les pointages ? Non : audit conservé.
      return res.status(200).json({
        ok: true,
        rapport: {
          dateISO: structure.dateISO,
          jourLabel: structure.jourLabel,
          seuilTexte: structure.seuilTexte,
          departements: structure.departements.map((d) => ({
            nom: d.nom,
            presents: d.presents,
            absents: d.absents,
            effectif: d.effectif,
          })),
          recap: structure.recap,
        },
        email: { destinataires: dests, messageId },
      });
    } catch (err) {
      console.error("[RAPPORTS] Échec d'envoi email", err);
      return res.status(400).json({
        ok: false,
        code: "ENVOI_EMAIL_ECHOUE",
        message:
          "L'envoi de l'email a échoué : " +
          (err?.message ? String(err.message) : "erreur SMTP inconnue"),
      });
    }
  } catch (err) {
    console.error("[RAPPORTS]", err);
    return res.status(500).json({
      ok: false,
      code: "ERREUR_INTERNE",
      message: "Une erreur interne est survenue",
    });
  }
});

export default router;