import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import prisma from "../lib/prisma.js";
import { ipReelle } from "../lib/ip.js";

const router = Router();

// Limite de débit du kiosque : blocage raisonnable d'un inondation d'écritures
// (un badgeage légitime = 1 requête/jour/ouvrier). La clé est l'IP RÉELLE du
// client (X-Vercel-Forwarded-For), non forgable — X-Forwarded-For est ignoré.
const limiterBadgeage = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: (req) => `badgeage:${ipReelle(req)}`,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    ok: false,
    code: "TROP_DE_TENTATIVES",
    message: "Trop de badgeages en même temps. Réessayez dans une minute.",
  },
});
router.post("/", limiterBadgeage, async (req, res) => {
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
      include: {
        departements: {
          include: { departement: { select: { id: true, nom: true } } },
          take: 1,
        },
      },
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

    // 3bis. Un seul badgeage par jour civil (UTC). La colonne `jour` (Date) +
    // l'index UNIQUE (ouvrierId, jour) rendent cette règle ATOMIQUE en base :
    // deux requêtes simultanées ne peuvent pas créer deux pointages.
    const jourISO = new Date().toISOString().slice(0, 10); // AAAA-MM-JJ (UTC)
    const jour = new Date(`${jourISO}T00:00:00.000Z`);

    const existant = await prisma.pointage.findUnique({
      where: { ouvrierId_jour: { ouvrierId: ouvrier.id, jour } },
    });

    if (existant) {
      const heure = existant.dateHeure.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      });
      return res.status(409).json({
        ok: false,
        code: "DEJA_BADGE_AUJOURDHUI",
        message: `Vous avez déjà badgé aujourd'hui à ${heure} (heure UTC)`,
      });
    }

    try {
      // 4. Badge valide => pointage (heure serveur). L'écriture est
      //    conditionnée par la contrainte unique : en cas de course entre deux
      //    requêtes, seule la première aboutit, l'autre reçoit P2002.
      await prisma.pointage.create({
        data: {
          ouvrierId: ouvrier.id,
          dateHeure: new Date(),
          jour,
        },
      });
    } catch (err) {
      if (err.code === "P2002") {
        const vainqueur = await prisma.pointage.findUnique({
          where: { ouvrierId_jour: { ouvrierId: ouvrier.id, jour } },
        });
        const heure = vainqueur.dateHeure.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
        });
        return res.status(409).json({
          ok: false,
          code: "DEJA_BADGE_AUJOURDHUI",
          message: `Vous avez déjà badgé aujourd'hui à ${heure} (heure UTC)`,
        });
      }
      throw err;
    }

    // 5. Réponse au terminal : uniquement les infos nécessaires à l'affichage
    return res.status(200).json({
      ok: true,
      ouvrier: {
        id: ouvrier.id,
        matricule: ouvrier.matricule,
        nom: ouvrier.nom,
        prenom: ouvrier.prenom,
        departement: ouvrier.departements[0]?.departement?.nom ?? null,
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