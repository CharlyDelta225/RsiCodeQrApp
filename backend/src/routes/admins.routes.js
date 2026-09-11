import { Router } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import { requireRole } from "../middleware/auth.middleware.js";
import { envoyerEmailSimple, genererMotDePasse } from "../lib/mailer.js";

const router = Router();

// Gestion des comptes admin : réservé au SUPER_ADMIN.
const SUPER_SEULEMENT = requireRole("SUPER_ADMIN");

const ROLES_VALIDES = ["SUPER_ADMIN", "ADMIN", "LECTEUR"];

function roleValide(role) {
  return ROLES_VALIDES.includes(String(role || "").toUpperCase());
}

/**
 * Envoie (ou tente d'envoyer) un email contenant le mot de passe temporaire.
 * En cas d'échec SMTP, on ne perd pas le mot de passe : il est renvoyé dans
 * la réponse (emailEnvoye:false) pour que le SUPER_ADMIN le transmette
 * lui-même. En cas de succès, il n'est JAMAIS exposé côté API.
 */
async function envoyerIdentifiants({ email, motDePasse, type }) {
  const sujets = {
    creation: "Votre compte RSI a été créé",
    reinitialisation: "Votre mot de passe RSI a été réinitialisé",
  };
  const textes = {
    creation: [
      `Bonjour,`,
      ``,
      `Un compte a été créé pour vous sur la plateforme RSI.`,
      `Adresse : ${email}`,
      `Mot de passe (temporaire) : ${motDePasse}`,
      ``,
      `Connectez-vous sur ${process.env.APP_URL || "http://localhost:5174"}.`,
      `Pensez à changer ce mot de passe.`,
      `L'équipe technique RSI.`,
    ].join("\n"),
    reinitialisation: [
      `Bonjour,`,
      ``,
      `Votre mot de passe RSI a été réinitialisé par un administrateur.`,
      `Mot de passe (temporaire) : ${motDePasse}`,
      ``,
      `Connectez-vous sur ${process.env.APP_URL || "http://localhost:5174"}.`,
      `Pensez à changer ce mot de passe.`,
      `L'équipe technique RSI.`,
    ].join("\n"),
  };

  try {
    await envoyerEmailSimple({
      to: email,
      sujet: sujets[type] || sujets.creation,
      texte: textes[type] || textes.creation,
    });
    return { emailEnvoye: true };
  } catch (err) {
    console.error("[ADMINS/EMAIL]", err);
    return { emailEnvoye: false, motDePasseTemporaire: motDePasse };
  }
}

/**
 * GET /api/admins
 * Liste tous les comptes admin (pour la gestion des rôles côté dashboard).
 * Réservé au SUPER_ADMIN.
 */
router.get("/", SUPER_SEULEMENT, async (_req, res) => {
  try {
    const admins = await prisma.admin.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        actif: true,
        tentativesEchouees: true,
        bloqueJusqua: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    return res.json({ ok: true, admins });
  } catch (err) {
    console.error("[ADMINS/LISTE]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * POST /api/admins
 * Crée un compte admin. Réservé au SUPER_ADMIN.
 * Body : { "email": "...", "role": "SUPER_ADMIN" | "ADMIN" | "LECTEUR" }
 * Un mot de passe temporaire fort est GÉNÉRÉ côté serveur puis envoyé par
 * email au compte. Voir envoyerIdentifiants pour le comportement si l'envoi
 * échoue (mot de passe renvoyé une seule fois dans la réponse).
 */
router.post("/", SUPER_SEULEMENT, async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const role = String(req.body?.role ?? "").toUpperCase();

    if (!email) {
      return res.status(400).json({ ok: false, code: "CHAMPS_MANQUANTS", message: "email est requis" });
    }
    if (!roleValide(role)) {
      return res.status(400).json({ ok: false, code: "ROLE_INVALIDE", message: "Le rôle doit être SUPER_ADMIN, ADMIN ou LECTEUR" });
    }

    const existe = await prisma.admin.findUnique({ where: { email } });
    if (existe) {
      return res.status(409).json({ ok: false, code: "EMAIL_EXISTANT", message: "Cet email est déjà enregistré" });
    }

    const motDePasseTemporaire = genererMotDePasse();
    const hash = await bcrypt.hash(motDePasseTemporaire, 10);

    const admin = await prisma.admin.create({
      data: { email, motDePasse: hash, role },
      select: { id: true, email: true, role: true, actif: true, createdAt: true },
    });

    const envoi = await envoyerIdentifiants({
      email,
      motDePasse: motDePasseTemporaire,
      type: "creation",
    });

    return res.status(201).json({
      ok: true,
      admin,
      emailEnvoye: envoi.emailEnvoye,
      // UNIQUEMENT si l'email a échoué : le SUPER_ADMIN doit transmettre le
      // mot de passe lui-même. En cas de succès, le champ est absent.
      ...(envoi.emailEnvoye ? {} : { motDePasseTemporaire: envoi.motDePasseTemporaire }),
      message: envoi.emailEnvoye
        ? "Compte créé. Le mot de passe a été envoyé par email."
        : "Compte créé mais l'email n'a pas pu être envoyé : transmettez le mot de passe temporaire affiché.",
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ ok: false, code: "EMAIL_EXISTANT", message: "Cet email est déjà enregistré" });
    }
    console.error("[ADMINS/CREATION]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * PATCH /api/admins/:id/role
 * Change le rôle d'un compte admin. Réservé au SUPER_ADMIN.
 * Body : { "role": "ADMIN" | "LECTEUR" | "SUPER_ADMIN" }
 *
 * Garde-fou : un SUPER_ADMIN ne peut PAS modifier son propre rôle (évite de
 * se couper accidentellement l'accès).
 */
router.patch("/:id/role", SUPER_SEULEMENT, async (req, res) => {
  try {
    const role = String(req.body?.role ?? "").toUpperCase();
    if (!roleValide(role)) {
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
      select: { id: true, email: true, role: true, actif: true, tentativesEchouees: true, bloqueJusqua: true, createdAt: true },
    });

    return res.json({ ok: true, admin });
  } catch (err) {
    console.error("[ADMINS/ROLE]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * PATCH /api/admins/:id/activer
 * Réactive un compte désactivé (le badge utilisateur redevient possible).
 * Réservé au SUPER_ADMIN.
 */
router.patch("/:id/activer", SUPER_SEULEMENT, async (req, res) => {
  try {
    const cible = await prisma.admin.findUnique({ where: { id: req.params.id } });
    if (!cible) {
      return res.status(404).json({ ok: false, code: "ADMIN_INCONNU", message: "Compte admin introuvable" });
    }
    const admin = await prisma.admin.update({
      where: { id: cible.id },
      data: { actif: true },
      select: { id: true, email: true, role: true, actif: true, tentativesEchouees: true, bloqueJusqua: true, createdAt: true },
    });
    return res.json({ ok: true, admin });
  } catch (err) {
    console.error("[ADMINS/ACTIVER]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * PATCH /api/admins/:id/desactiver
 * Désactive un compte : plus aucune connexion possible (403 COMPTE_DESACTIVE).
 * Réservé au SUPER_ADMIN. Impossible sur son propre compte.
 */
router.patch("/:id/desactiver", SUPER_SEULEMENT, async (req, res) => {
  try {
    const cible = await prisma.admin.findUnique({ where: { id: req.params.id } });
    if (!cible) {
      return res.status(404).json({ ok: false, code: "ADMIN_INCONNU", message: "Compte admin introuvable" });
    }
    if (cible.id === req.admin.id) {
      return res.status(403).json({ ok: false, code: "ACTION_IMPOSSIBLE", message: "Vous ne pouvez pas désactiver votre propre compte" });
    }
    const admin = await prisma.admin.update({
      where: { id: cible.id },
      data: { actif: false },
      select: { id: true, email: true, role: true, actif: true, tentativesEchouees: true, bloqueJusqua: true, createdAt: true },
    });
    return res.json({ ok: true, admin });
  } catch (err) {
    console.error("[ADMINS/DESACTIVER]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * PATCH /api/admins/:id/debloquer
 * Lève le blocage anti brute-force (après 3 échecs) et remet le compteur à zéro.
 * Réservé au SUPER_ADMIN.
 */
router.patch("/:id/debloquer", SUPER_SEULEMENT, async (req, res) => {
  try {
    const cible = await prisma.admin.findUnique({ where: { id: req.params.id } });
    if (!cible) {
      return res.status(404).json({ ok: false, code: "ADMIN_INCONNU", message: "Compte admin introuvable" });
    }
    const admin = await prisma.admin.update({
      where: { id: cible.id },
      data: { tentativesEchouees: 0, bloqueJusqua: null },
      select: { id: true, email: true, role: true, actif: true, tentativesEchouees: true, bloqueJusqua: true, createdAt: true },
    });
    return res.json({ ok: true, admin });
  } catch (err) {
    console.error("[ADMINS/DEBLOQUER]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * POST /api/admins/:id/reinitialiser-mot-de-passe
 * Génère un nouveau mot de passe temporaire et l'envoie par email, sans
 * passer par un lien (cas "j'ai perdu mon accès" géré par le SUPER_ADMIN).
 * Remet aussi à zéro blocage/tentatives. Réservé au SUPER_ADMIN.
 */
router.post("/:id/reinitialiser-mot-de-passe", SUPER_SEULEMENT, async (req, res) => {
  try {
    const cible = await prisma.admin.findUnique({ where: { id: req.params.id } });
    if (!cible) {
      return res.status(404).json({ ok: false, code: "ADMIN_INCONNU", message: "Compte admin introuvable" });
    }

    const motDePasseTemporaire = genererMotDePasse();
    const hash = await bcrypt.hash(motDePasseTemporaire, 10);

    await prisma.admin.update({
      where: { id: cible.id },
      data: {
        motDePasse: hash,
        resetTokenHash: null,
        resetTokenExpire: null,
        tentativesEchouees: 0,
        bloqueJusqua: null,
      },
    });

    const envoi = await envoyerIdentifiants({
      email: cible.email,
      motDePasse: motDePasseTemporaire,
      type: "reinitialisation",
    });

    return res.json({
      ok: true,
      emailEnvoye: envoi.emailEnvoye,
      ...(envoi.emailEnvoye ? {} : { motDePasseTemporaire: envoi.motDePasseTemporaire }),
      message: envoi.emailEnvoye
        ? "Mot de passe réinitialisé et envoyé par email."
        : "Mot de passe réinitialisé mais l'email n'a pas pu être envoyé : transmettez le mot de passe temporaire affiché.",
    });
  } catch (err) {
    console.error("[ADMINS/REINITIALISER_MDP]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * DELETE /api/admins/:id
 * Supprime un compte admin. Réservé au SUPER_ADMIN.
 * Après un mot de passe oublié sans email exploitable, ou pour retirer un
 * compte. Garde-fous : impossible sur soi-même, impossible de supprimer le
 * dernier SUPER_ADMIN (évite de verrouiller l'application).
 */
router.delete("/:id", SUPER_SEULEMENT, async (req, res) => {
  try {
    const cible = await prisma.admin.findUnique({ where: { id: req.params.id } });
    if (!cible) {
      return res.status(404).json({ ok: false, code: "ADMIN_INCONNU", message: "Compte admin introuvable" });
    }
    if (cible.id === req.admin.id) {
      return res.status(403).json({ ok: false, code: "ACTION_IMPOSSIBLE", message: "Vous ne pouvez pas supprimer votre propre compte" });
    }

    if (cible.role === "SUPER_ADMIN") {
      const nbSuper = await prisma.admin.count({ where: { role: "SUPER_ADMIN" } });
      if (nbSuper <= 1) {
        return res.status(403).json({ ok: false, code: "DERNIER_SUPER_ADMIN", message: "Impossible de supprimer le dernier SUPER_ADMIN" });
      }
    }

    await prisma.admin.delete({ where: { id: cible.id } });
    return res.json({ ok: true });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ ok: false, code: "ADMIN_INCONNU", message: "Compte admin introuvable" });
    }
    console.error("[ADMINS/SUPPRESSION]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

export default router;