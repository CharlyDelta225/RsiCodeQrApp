import express, { Router } from "express";
import logger from "../lib/logger.js";
import prisma from "../lib/prisma.js";
import { requireRole } from "../middleware/auth.middleware.js";

// ==============================
// Atelier des cartes de badge
//
// Données de la carte (nom, fonction, matricule, district, département et
// sa couleur), photo d'identité et suivi des cartes confectionnées.
// Lecture : tout admin connecté. Écriture : ADMIN et SUPER_ADMIN.
// ==============================

const router = Router();
const ECRITURE = requireRole("ADMIN", "SUPER_ADMIN");

export const TAILLE_MAX_PHOTO = 1024 * 1024; // 1 Mo (la photo est compressée dans le navigateur)
const TYPES_PHOTO = ["image/jpeg", "image/png", "image/webp"];

// Fonction imprimée par défaut, selon le rôle dans le département.
export const FONCTION_PAR_ROLE = Object.freeze({
  RESPONSABLE: "RESPONSABLE",
  ADJOINT: "RESPONSABLE ADJOINT",
  SECRETAIRE: "SECRÉTAIRE",
  MEMBRE: "MEMBRE",
});

const COULEUR = /^#[0-9A-F]{6}$/;

const erreurInterne = (res) =>
  res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
const ouvrierInconnu = (res) =>
  res.status(404).json({ ok: false, code: "OUVRIER_INCONNU", message: "Ouvrier introuvable" });

/** Type réel d'une image d'après ses premiers octets (le Content-Type ne suffit pas). */
export function typeImage(octets) {
  if (!octets || octets.length < 12) return null;
  if (octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff) return "image/jpeg";
  if (octets.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (octets.subarray(0, 4).toString("latin1") === "RIFF" && octets.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

/** Normalise une couleur saisie (« bd175c », « #BD175C ») ; null = effacer ; undefined = invalide. */
export function normaliserCouleur(valeur) {
  if (valeur === null || valeur === "") return null;
  const v = String(valeur).trim().toUpperCase();
  const hex = v.startsWith("#") ? v : `#${v}`;
  return COULEUR.test(hex) ? hex : undefined;
}

/** Ligne « district » imprimée : libellé du temple, sinon « DISTRICT <NOM> ». */
const districtDe = (eglise) =>
  eglise.libelleCarte || `DISTRICT ${eglise.nom.replace(/^temple\s+(de\s+|du\s+)?/i, "").toUpperCase()}`;

async function emailAdmin(req) {
  if (!req.admin?.id) return null;
  const admin = await prisma.admin.findUnique({ where: { id: req.admin.id }, select: { email: true } });
  return admin?.email ?? null;
}

/**
 * GET /api/badges/carte/:ouvrierId
 * Tout ce qu'il faut pour dessiner la carte :
 * { ok, carte: { ouvrier: { id, matricule, nom, prenom, actif }, district, eglise,
 *   aPhoto, photoMaj, departements: [{ id, nom, nomCarte, couleur, modeleCarte, role, fonction, fonctionCarte,
 *   confectionneLe }] } }
 */
router.get("/carte/:ouvrierId", async (req, res) => {
  try {
    const o = await prisma.ouvrier.findUnique({
      where: { id: req.params.ouvrierId },
      select: {
        id: true, matricule: true, nom: true, prenom: true, actif: true,
        eglise: { select: { id: true, code: true, nom: true, estSiege: true, libelleCarte: true } },
        photo: { select: { updatedAt: true } },
        departements: {
          select: {
            roleDansDepartement: true,
            fonctionCarte: true,
            departement: { select: { id: true, nom: true, couleur: true, libelleCarte: true, modeleCarte: true } },
          },
          orderBy: { departement: { nom: "asc" } },
        },
        badges: { select: { departementId: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!o) return ouvrierInconnu(res);

    const derniere = new Map();
    for (const b of o.badges) if (!derniere.has(b.departementId)) derniere.set(b.departementId, b.createdAt);

    const { libelleCarte, ...eglise } = o.eglise;
    return res.json({
      ok: true,
      carte: {
        ouvrier: { id: o.id, matricule: o.matricule, nom: o.nom, prenom: o.prenom, actif: o.actif },
        eglise,
        district: districtDe({ ...eglise, libelleCarte }),
        aPhoto: Boolean(o.photo),
        photoMaj: o.photo?.updatedAt ?? null,
        departements: o.departements.map((l) => ({
          id: l.departement.id,
          nom: l.departement.nom,
          // Nom imprimé sur la carte (libellé du département, sinon son nom).
          nomCarte: l.departement.libelleCarte || l.departement.nom,
          couleur: l.departement.couleur,
          modeleCarte: l.departement.modeleCarte,
          role: l.roleDansDepartement,
          fonctionCarte: l.fonctionCarte,
          fonction: l.fonctionCarte || FONCTION_PAR_ROLE[l.roleDansDepartement] || "MEMBRE",
          confectionneLe: derniere.get(l.departement.id) ?? null,
        })),
      },
    });
  } catch (err) {
    logger.error("[BADGES/CARTE]", err);
    return erreurInterne(res);
  }
});

/** GET /api/badges/photo/:ouvrierId → l'image (404 si aucune). */
router.get("/photo/:ouvrierId", async (req, res) => {
  try {
    const photo = await prisma.photoOuvrier.findUnique({ where: { ouvrierId: req.params.ouvrierId } });
    if (!photo) return res.status(404).json({ ok: false, code: "AUCUNE_PHOTO", message: "Cet ouvrier n'a pas de photo" });
    res.setHeader("Content-Type", photo.type);
    // ?v=<date de la photo> : l'URL change à chaque nouvelle photo, le navigateur peut la garder.
    res.setHeader("Cache-Control", req.query.v ? "private, max-age=86400" : "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(Buffer.from(photo.donnees));
  } catch (err) {
    logger.error("[BADGES/PHOTO/LECTURE]", err);
    return erreurInterne(res);
  }
});

/**
 * POST /api/badges/photo/:ouvrierId
 * Corps : l'image brute (Content-Type image/jpeg, image/png ou image/webp), 1 Mo max.
 */
router.post(
  "/photo/:ouvrierId",
  ECRITURE,
  express.raw({ type: TYPES_PHOTO, limit: TAILLE_MAX_PHOTO }),
  async (req, res) => {
    try {
      const octets = Buffer.isBuffer(req.body) ? req.body : null;
      const type = typeImage(octets);
      if (!type) {
        return res.status(400).json({ ok: false, code: "PHOTO_INVALIDE", message: "Envoyez une photo JPG, PNG ou WebP" });
      }
      const ouvrier = await prisma.ouvrier.findUnique({ where: { id: req.params.ouvrierId }, select: { id: true } });
      if (!ouvrier) return ouvrierInconnu(res);
      const photo = await prisma.photoOuvrier.upsert({
        where: { ouvrierId: ouvrier.id },
        create: { ouvrierId: ouvrier.id, type, donnees: octets },
        update: { type, donnees: octets },
        select: { updatedAt: true },
      });
      return res.json({ ok: true, photoMaj: photo.updatedAt });
    } catch (err) {
      logger.error("[BADGES/PHOTO/ENVOI]", err);
      return erreurInterne(res);
    }
  }
);

/** DELETE /api/badges/photo/:ouvrierId */
router.delete("/photo/:ouvrierId", ECRITURE, async (req, res) => {
  try {
    await prisma.photoOuvrier.deleteMany({ where: { ouvrierId: req.params.ouvrierId } });
    return res.json({ ok: true });
  } catch (err) {
    logger.error("[BADGES/PHOTO/SUPPRESSION]", err);
    return erreurInterne(res);
  }
});

/**
 * PATCH /api/badges/fonction/:ouvrierId/:departementId
 * Body : { fonctionCarte: "RESPONSABLE ADJOINTE" | "" } — vide = revenir au rôle.
 */
router.patch("/fonction/:ouvrierId/:departementId", ECRITURE, async (req, res) => {
  try {
    const texte = String(req.body?.fonctionCarte ?? "").trim().toUpperCase().slice(0, 60) || null;
    const lien = await prisma.ouvrierDepartement.updateMany({
      where: { ouvrierId: req.params.ouvrierId, departementId: req.params.departementId },
      data: { fonctionCarte: texte },
    });
    if (lien.count === 0) {
      return res.status(404).json({ ok: false, code: "LIEN_INCONNU", message: "Cet ouvrier n'est pas dans ce département" });
    }
    return res.json({ ok: true, fonctionCarte: texte });
  } catch (err) {
    logger.error("[BADGES/FONCTION]", err);
    return erreurInterne(res);
  }
});

/**
 * POST /api/badges/confectionnes
 * Body : { ouvrierId, departementId } — appelé quand la carte est imprimée ou téléchargée.
 */
router.post("/confectionnes", ECRITURE, async (req, res) => {
  try {
    const { ouvrierId, departementId } = req.body ?? {};
    const lien = await prisma.ouvrierDepartement.findFirst({
      where: { ouvrierId: String(ouvrierId ?? ""), departementId: String(departementId ?? "") },
      select: { departement: { select: { couleur: true } } },
    });
    if (!lien) {
      return res.status(404).json({ ok: false, code: "LIEN_INCONNU", message: "Cet ouvrier n'est pas dans ce département" });
    }
    if (!lien.departement.couleur) {
      return res.status(409).json({
        ok: false,
        code: "COULEUR_MANQUANTE",
        message: "Définissez d'abord la couleur de ce département",
      });
    }
    const badge = await prisma.badgeConfectionne.create({
      data: { ouvrierId, departementId, adminEmail: await emailAdmin(req) },
      select: { id: true, createdAt: true },
    });
    return res.status(201).json({ ok: true, badge });
  } catch (err) {
    logger.error("[BADGES/CONFECTION]", err);
    return erreurInterne(res);
  }
});

/**
 * POST /api/badges/confectionnes/lot
 * Body : { departementId, ouvrierIds: [] } — cartes d'un département sorties en lot
 * (export ZIP ou impression). Les ouvriers hors du département sont ignorés.
 * { ok, crees, ignores }
 */
router.post("/confectionnes/lot", ECRITURE, async (req, res) => {
  try {
    const departementId = String(req.body?.departementId ?? "");
    const ids = Array.isArray(req.body?.ouvrierIds) ? [...new Set(req.body.ouvrierIds.map(String))].slice(0, 500) : [];
    if (!departementId || ids.length === 0) {
      return res.status(400).json({ ok: false, code: "CHAMPS_MANQUANTS", message: "departementId et ouvrierIds sont requis" });
    }
    const departement = await prisma.departement.findUnique({ where: { id: departementId }, select: { couleur: true } });
    if (!departement) {
      return res.status(404).json({ ok: false, code: "DEPARTEMENT_INTROUVABLE", message: "Département introuvable" });
    }
    if (!departement.couleur) {
      return res.status(409).json({ ok: false, code: "COULEUR_MANQUANTE", message: "Définissez d'abord la couleur de ce département" });
    }
    const liens = await prisma.ouvrierDepartement.findMany({
      where: { departementId, ouvrierId: { in: ids } },
      select: { ouvrierId: true },
    });
    const adminEmail = await emailAdmin(req);
    const { count } = await prisma.badgeConfectionne.createMany({
      data: liens.map((l) => ({ ouvrierId: l.ouvrierId, departementId, adminEmail })),
    });
    return res.status(201).json({ ok: true, crees: count, ignores: ids.length - count });
  } catch (err) {
    logger.error("[BADGES/CONFECTION_LOT]", err);
    return erreurInterne(res);
  }
});

/**
 * GET /api/badges/a-confectionner?egliseId=&departementId=
 * Ouvriers actifs qui n'ont encore aucune carte confectionnée.
 * { ok, total, ouvriers: [{ id, matricule, nom, prenom, departements: [nom] }] }
 */
router.get("/a-confectionner", async (req, res) => {
  try {
    const where = { actif: true, badges: { none: {} } };
    if (req.query.egliseId) where.egliseId = String(req.query.egliseId);
    if (req.query.departementId) where.departements = { some: { departementId: String(req.query.departementId) } };
    const [total, ouvriers] = await Promise.all([
      prisma.ouvrier.count({ where }),
      prisma.ouvrier.findMany({
        where,
        orderBy: [{ nom: "asc" }, { prenom: "asc" }],
        take: 500,
        select: {
          id: true, matricule: true, nom: true, prenom: true,
          departements: { select: { departement: { select: { nom: true } } } },
        },
      }),
    ]);
    return res.json({
      ok: true,
      total,
      ouvriers: ouvriers.map((o) => ({ ...o, departements: o.departements.map((d) => d.departement.nom).sort() })),
    });
  } catch (err) {
    logger.error("[BADGES/A_CONFECTIONNER]", err);
    return erreurInterne(res);
  }
});

/**
 * GET /api/badges/departement/:departementId
 * Ouvriers actifs du département, responsables d'abord, avec l'état de leur
 * carte pour ce département.
 * Tout ce qu'il faut pour dessiner les cartes du département en une fois :
 * { ok, departement: { id, nom, nomCarte, libelleCarte, couleur, modeleCarte, egliseId, district },
 *   ouvriers: [{ id, matricule, nom, prenom, role, fonction, aPhoto, photoMaj, confectionneLe }] }
 */
const ORDRE_ROLE = { RESPONSABLE: 0, ADJOINT: 1, SECRETAIRE: 2 };

router.get("/departement/:departementId", async (req, res) => {
  try {
    const departement = await prisma.departement.findUnique({
      where: { id: req.params.departementId },
      select: {
        id: true, nom: true, couleur: true, libelleCarte: true, modeleCarte: true,
        eglise: { select: { id: true, nom: true, libelleCarte: true } },
      },
    });
    if (!departement) {
      return res.status(404).json({ ok: false, code: "DEPARTEMENT_INTROUVABLE", message: "Département introuvable" });
    }
    const liens = await prisma.ouvrierDepartement.findMany({
      where: { departementId: departement.id, ouvrier: { actif: true } },
      select: {
        roleDansDepartement: true,
        fonctionCarte: true,
        ouvrier: {
          select: {
            id: true, matricule: true, nom: true, prenom: true,
            photo: { select: { updatedAt: true } },
            badges: {
              where: { departementId: departement.id },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { createdAt: true },
            },
          },
        },
      },
    });
    const ouvriers = liens
      .map(({ roleDansDepartement: role, fonctionCarte, ouvrier: o }) => ({
        id: o.id,
        matricule: o.matricule,
        nom: o.nom,
        prenom: o.prenom,
        role,
        fonction: fonctionCarte || FONCTION_PAR_ROLE[role] || "MEMBRE",
        aPhoto: Boolean(o.photo),
        photoMaj: o.photo?.updatedAt ?? null,
        confectionneLe: o.badges[0]?.createdAt ?? null,
      }))
      .sort(
        (a, b) =>
          (ORDRE_ROLE[a.role] ?? 9) - (ORDRE_ROLE[b.role] ?? 9) ||
          a.nom.localeCompare(b.nom, "fr") ||
          (a.prenom || "").localeCompare(b.prenom || "", "fr")
      );
    const { eglise, libelleCarte, ...dep } = departement;
    return res.json({
      ok: true,
      departement: { ...dep, libelleCarte, nomCarte: libelleCarte || dep.nom, egliseId: eglise.id, district: districtDe(eglise) },
      ouvriers,
    });
  } catch (err) {
    logger.error("[BADGES/DEPARTEMENT]", err);
    return erreurInterne(res);
  }
});

export default router;
