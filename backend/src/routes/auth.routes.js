import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import requireAuth from "../middleware/auth.middleware.js";

const router = Router();

/**
 * POST /api/auth/register
 * Crée un premier compte admin (phase de mise en place). À restreindre
 * à un usage ponctuel (ou à supprimer avant la mise en production).
 * Body : { "email": "...", "motDePasse": "..." }  (motDePasse >= 8 caractères)
 */
router.post("/register", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const motDePasse = String(req.body?.motDePasse ?? "");

    if (!email || !motDePasse) {
      return res.status(400).json({ ok: false, code: "CHAMPS_MANQUANTS", message: "email et motDePasse sont requis" });
    }
    if (motDePasse.length < 8) {
      return res.status(400).json({ ok: false, code: "MOT_DE_PASSE_TROP_COURT", message: "Le mot de passe doit faire au moins 8 caractères" });
    }

    const existe = await prisma.admin.findUnique({ where: { email } });
    if (existe) {
      return res.status(409).json({ ok: false, code: "EMAIL_EXISTANT", message: "Cet email est déjà enregistré" });
    }

    // Le mot de passe n'est JAMAIAS stocké en clair : hash bcrypt + sel intégré
    const hash = await bcrypt.hash(motDePasse, 10);

    const admin = await prisma.admin.create({
      data: { email, motDePasse: hash },
      select: { id: true, email: true, createdAt: true },
    });

    return res.status(201).json({ ok: true, admin });
  } catch (err) {
    console.error("[AUTH/REGISTER]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * POST /api/auth/login
 * Body : { "email": "...", "motDePasse": "..." }
 * Retourne : { ok: true, token, admin: { id, email } }
 * Le token JWT doit être envoyé ensuite dans l'en-tête :
 *   Authorization: Bearer <token>
 */
router.post("/login", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const motDePasse = String(req.body?.motDePasse ?? "");

    if (!email || !motDePasse) {
      return res.status(400).json({ ok: false, code: "CHAMPS_MANQUANTS", message: "email et motDePasse sont requis" });
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      // Réponse volontairement identique au cas "mauvais mot de passe" :
      // ne pas révéler si l'email existe ou non (anti-énumération).
      return res.status(401).json({ ok: false, code: "IDENTIFIANTS_INVALIDES", message: "Email ou mot de passe incorrect" });
    }

    const bon = await bcrypt.compare(motDePasse, admin.motDePasse);
    if (!bon) {
      return res.status(401).json({ ok: false, code: "IDENTIFIANTS_INVALIDES", message: "Email ou mot de passe incorrect" });
    }

    // Token 24h. Le "sub" = id de l'admin (utilisé par requireAuth).
    const token = jwt.sign({ sub: admin.id }, process.env.JWT_SECRET, { expiresIn: "24h" });

    return res.json({
      ok: true,
      token,
      admin: { id: admin.id, email: admin.email },
    });
  } catch (err) {
    console.error("[AUTH/LOGIN]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * GET /api/auth/me
 * Renvoie les infos de l'admin connecté (pour vérifier que le token est valide).
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { id: true, email: true, createdAt: true },
    });
    if (!admin) {
      return res.status(404).json({ ok: false, code: "ADMIN_INCONNU", message: "Admin introuvable" });
    }
    return res.json({ ok: true, admin });
  } catch (err) {
    console.error("[AUTH/ME]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

export default router;