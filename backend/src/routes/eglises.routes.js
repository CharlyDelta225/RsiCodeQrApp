import logger from "../lib/logger.js";
import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireRole } from "../middleware/auth.middleware.js";
import { cleEglise, listerEglises } from "../lib/eglises.js";

// Gestion des temples. Lecture : tout admin connecté. Écriture : SUPER_ADMIN.
const router = Router();
const SUPER = requireRole("SUPER_ADMIN");

// Liste publique (sans authentification) : sert au terminal pour afficher et
// choisir son temple. Ne renvoie que des libellés, aucun compteur.
export const routeurPublic = Router();

const erreurInterne = (res) =>
  res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });

/** GET /api/eglises/public → { ok, eglises: [{ code, nom, estSiege }] } (temples actifs) */
routeurPublic.get("/", async (_req, res) => {
  try {
    const eglises = (await listerEglises())
      .filter((e) => e.actif)
      .map((e) => ({ code: e.code, nom: e.nom, estSiege: e.estSiege }));
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.json({ ok: true, eglises });
  } catch (err) {
    logger.error("[EGLISES/PUBLIC]", err);
    return erreurInterne(res);
  }
});

/**
 * GET /api/eglises
 * Réponse : { ok, eglises: [{ id, code, nom, estSiege, actif, createdAt,
 *   ouvriers, ouvriersActifs, departements, presentsAuj }] }
 * presentsAuj = ouvriers DU temple ayant badgé aujourd'hui (où qu'ils aient badgé).
 */
router.get("/", async (_req, res) => {
  try {
    const aujISO = new Date().toISOString().slice(0, 10);
    const auj = new Date(`${aujISO}T00:00:00.000Z`);
    const eglises = await listerEglises();
    const compteurs = await Promise.all(
      eglises.map((e) =>
        Promise.all([
          prisma.ouvrier.count({ where: { egliseId: e.id } }),
          prisma.ouvrier.count({ where: { egliseId: e.id, actif: true } }),
          prisma.departement.count({ where: { egliseId: e.id } }),
          prisma.pointage.count({ where: { jour: auj, ouvrier: { egliseId: e.id } } }),
        ])
      )
    );
    return res.json({
      ok: true,
      eglises: eglises.map((e, i) => {
        const [ouvriers, ouvriersActifs, departements, presentsAuj] = compteurs[i];
        return { ...e, ouvriers, ouvriersActifs, departements, presentsAuj };
      }),
    });
  } catch (err) {
    logger.error("[EGLISES/LISTE]", err);
    return erreurInterne(res);
  }
});

function codeDepuis(valeur) {
  return String(valeur ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Refuse un nom ou un code qui se confondrait avec un temple existant. */
async function conflit(nom, code, idExclu = null) {
  const autres = (await listerEglises()).filter((e) => e.id !== idExclu);
  return autres.some(
    (e) =>
      (nom && cleEglise(e.nom) === cleEglise(nom)) ||
      (code && (e.code === code || cleEglise(e.code) === cleEglise(code)))
  );
}

/**
 * POST /api/eglises (SUPER_ADMIN)
 * Body : { nom: "Temple ...", code?: "CODE" } — code déduit du nom si absent.
 */
router.post("/", SUPER, async (req, res) => {
  try {
    const nom = String(req.body?.nom ?? "").trim();
    const code = codeDepuis(req.body?.code || nom.replace(/^temple\s+(de\s+)?/i, ""));
    if (!nom || !code) {
      return res.status(400).json({ ok: false, code: "CHAMPS_MANQUANTS", message: "Le nom du temple est requis" });
    }
    if (await conflit(nom, code)) {
      return res.status(409).json({ ok: false, code: "EGLISE_EXISTANTE", message: "Un temple porte déjà ce nom ou ce code" });
    }
    const eglise = await prisma.eglise.create({ data: { nom, code } });
    return res.status(201).json({ ok: true, eglise });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ ok: false, code: "EGLISE_EXISTANTE", message: "Un temple porte déjà ce nom ou ce code" });
    }
    logger.error("[EGLISES/CREATION]", err);
    return erreurInterne(res);
  }
});

/**
 * PATCH /api/eglises/:id (SUPER_ADMIN)
 * Body : { nom?, actif?, estSiege?, libelleCarte? } (libelleCarte = district imprimé sur les cartes). Le code ne change pas (il est imprimé
 * dans l'URL des terminaux). Un seul siège : en désigner un retire l'autre.
 * Le siège ne peut pas être désactivé.
 */
router.patch("/:id", SUPER, async (req, res) => {
  try {
    const eglise = await prisma.eglise.findUnique({ where: { id: req.params.id } });
    if (!eglise) {
      return res.status(404).json({ ok: false, code: "EGLISE_INCONNUE", message: "Temple introuvable" });
    }
    const donnees = {};
    if (req.body?.nom !== undefined) {
      const nom = String(req.body.nom).trim();
      if (!nom) return res.status(400).json({ ok: false, code: "CHAMPS_MANQUANTS", message: "Le nom ne peut pas être vide" });
      if (await conflit(nom, null, eglise.id)) {
        return res.status(409).json({ ok: false, code: "EGLISE_EXISTANTE", message: "Un temple porte déjà ce nom" });
      }
      donnees.nom = nom;
    }
    if (req.body?.actif !== undefined) donnees.actif = Boolean(req.body.actif);
    if (req.body?.libelleCarte !== undefined) {
      donnees.libelleCarte = String(req.body.libelleCarte ?? "").trim().toUpperCase().slice(0, 40) || null;
    }
    const devientSiege = req.body?.estSiege === true && !eglise.estSiege;
    const siegeFinal = devientSiege || (eglise.estSiege && req.body?.estSiege !== false);
    if (donnees.actif === false && siegeFinal) {
      return res.status(400).json({ ok: false, code: "SIEGE_INDESACTIVABLE", message: "Le siège ne peut pas être désactivé" });
    }
    if (req.body?.estSiege === false && eglise.estSiege) {
      return res.status(400).json({ ok: false, code: "SIEGE_REQUIS", message: "Désignez un autre temple comme siège plutôt que de retirer celui-ci" });
    }
    if (Object.keys(donnees).length === 0 && !devientSiege) {
      return res.status(400).json({ ok: false, code: "AUCUNE_DONNEE", message: "Aucune donnée à mettre à jour" });
    }

    const [, misAJour] = await prisma.$transaction([
      prisma.eglise.updateMany({ where: devientSiege ? { estSiege: true } : { id: "__aucun__" }, data: { estSiege: false } }),
      prisma.eglise.update({ where: { id: eglise.id }, data: { ...donnees, ...(devientSiege && { estSiege: true }) } }),
    ]);
    return res.json({ ok: true, eglise: misAJour });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ ok: false, code: "EGLISE_EXISTANTE", message: "Un temple porte déjà ce nom" });
    }
    logger.error("[EGLISES/MAJ]", err);
    return erreurInterne(res);
  }
});

export default router;
