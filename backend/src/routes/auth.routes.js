import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { rateLimit } from "express-rate-limit";
import prisma from "../lib/prisma.js";
import requireAuth from "../middleware/auth.middleware.js";

const router = Router();

// Anti brute-force : 5 tentatives / min / IP sur login+register.
// Un compteur dédié par IP évite qu'un attaquant épuise les comptes
// d'autres clients (et protège aussi contre l'énumération d'emails).
const limiterAuth = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    ok: false,
    code: "TROP_DE_TENTATIVES",
    message: "Trop de tentatives de connexion. Réessayez dans une minute.",
  },
});

// Appliqué aux deux routes sensibles (création de compte comprise : un
// attaquant pourrait sinon créer des comptes en masse depuis le net).
router.use("/login", limiterAuth);
router.use("/register", limiterAuth);

/**
 * POST /api/auth/register  (PUBLIC)
 * Création d'un compte. DÉFAUT : rôle LECTEUR (simple lecteur, aucun droit
 * d'écriture). L'élévation à ADMIN/SUPER_ADMIN se fait depuis le dashboard
 * par un SUPER_ADMIN (voir routes/admins.routes.js).
 *
 * Body : { "email": "...", "motDePasse": "..." }
 *   - role NON accepté ici : tout nouveau compte naît LECTEUR, aucun pouvoir.
 * motDePasse >= 8 caractères.
 */
router.post("/register", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const motDePasse = String(req.body?.motDePasse ?? "");

    // On IGNORE tout champ role fourni : un inscrit reste toujours LECTEUR.
    // C'est le principe du moindre privilège : l'élévation passe par le
    // SUPER_ADMIN dans PATCH /api/admins/:id/role.
    const role = "LECTEUR";

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
      data: { email, motDePasse: hash, role },
      select: { id: true, email: true, role: true, createdAt: true },
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
 * Retourne : { ok: true, token, admin: { id, email, role } }
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

    // Token 24h. "sub" = id de l'admin ; "role" embarqué pour requireRole.
    const token = jwt.sign(
      { sub: admin.id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.json({
      ok: true,
      token,
      admin: { id: admin.id, email: admin.email, role: admin.role },
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
      select: { id: true, email: true, role: true, createdAt: true },
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