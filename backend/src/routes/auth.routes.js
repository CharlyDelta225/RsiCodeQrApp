import crypto from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { rateLimit } from "express-rate-limit";
import prisma from "../lib/prisma.js";
import requireAuth from "../middleware/auth.middleware.js";
import { envoyerEmailSimple, urlDashboard } from "../lib/mailer.js";

const router = Router();

// -------------------------------
// Verrous de connexion (anti brute-force)
//   - limiterAuth : 5 requêtes/min/IP sur login+register (protège le réseau).
//   - Verrouillage par COMPTE : 3 mot de passe erronés → gel du compte 15 min.
//     Le SUPER_ADMIN peut le débloquer manuellement (routes/admins.routes.js).
// -------------------------------
const MAX_TENTATIVES = 3;
const DUREE_BLOCAGE_MS = 15 * 60 * 1000; // 15 minutes
const DUREE_LIEN_RESET_MS = 60 * 60 * 1000; // lien de réinitialisation valide 1h

// Les tokens de réinitialisation ne sont JAMAIS stockés en clair en base :
// on ne garde que leur empreinte SHA-256 (si la base fuit, un lien capturé
// ne sert à rien).
function sha256Hex(texte) {
  return crypto.createHash("sha256").update(texte).digest("hex");
}

// Anti brute-force : 5 tentatives / min / IP sur login+register+reset-demand.
// Un compteur dédié par IP évite qu'un attaquant épuise les comptes
// d'autres clients (et protège aussi contre l'énumération d'emails).
// Le maximum est surchargeable via AUTH_RATE_LIMIT_MAX (utile en test).
const LIMITE_AUTH_MAX = Math.max(1, parseInt(process.env.AUTH_RATE_LIMIT_MAX || "5", 10) || 5);
const limiterAuth = rateLimit({
  windowMs: 60 * 1000,
  limit: LIMITE_AUTH_MAX,
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
 *
 * Sécu :
 *   - 3 mot de passe erronés → 423 COMPTE_BLOQUE pendant 15 min.
 *   - Pendant le blocage, le code "reste" indique les minutes restantes.
 *   - Sur mot de passe erroné (avant blocage), "reste" = tentatives restantes.
 *   - Compte désactivé (actif=false) → 403 COMPTE_DESACTIVE.
 *   - Email inconnu : réponse identique à "mauvais mot de passe" (anti-énumération).
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

    const maintenant = new Date();

    if (!admin.actif) {
      return res.status(403).json({
        ok: false,
        code: "COMPTE_DESACTIVE",
        message: "Ce compte a été désactivé. Contactez un super administrateur.",
      });
    }

    if (admin.bloqueJusqua && admin.bloqueJusqua > maintenant) {
      const reste = Math.ceil((admin.bloqueJusqua - maintenant) / 60000);
      return res.status(423).json({
        ok: false,
        code: "COMPTE_BLOQUE",
        message: `Trop de tentatives. Compte bloqué, réessayez dans ${reste} minute(s).`,
        reste,
      });
    }

    const bon = await bcrypt.compare(motDePasse, admin.motDePasse);
    if (!bon) {
      const tentative = admin.tentativesEchouees + 1;
      if (tentative >= MAX_TENTATIVES) {
        // Troisième échec : gel du compte pour DUREE_BLOCAGE_MS (compteur remis à zéro).
        await prisma.admin.update({
          where: { id: admin.id },
          data: { tentativesEchouees: 0, bloqueJusqua: new Date(maintenant.getTime() + DUREE_BLOCAGE_MS) },
        });
        const reste = MAX_TENTATIVES;
        return res.status(423).json({
          ok: false,
          code: "COMPTE_BLOQUE",
          message: `Mot de passe incorrect. Compte bloqué pendant ${reste} minute(s).`,
          reste,
        });
      }
      await prisma.admin.update({
        where: { id: admin.id },
        data: { tentativesEchouees: tentative },
      });
      return res.status(401).json({
        ok: false,
        code: "IDENTIFIANTS_INVALIDES",
        message: `Email ou mot de passe incorrect. Il vous reste ${MAX_TENTATIVES - tentative} tentative(s).`,
        reste: MAX_TENTATIVES - tentative,
      });
    }

    // Succès : on remet le compteur à zéro (et on lève un éventuel blocage restant).
    if (admin.tentativesEchouees > 0 || admin.bloqueJusqua) {
      await prisma.admin.update({
        where: { id: admin.id },
        data: { tentativesEchouees: 0, bloqueJusqua: null },
      });
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
 * POST /api/auth/reset-demand   (PUBLIC, rate-limité)
 * Demande d'un lien de réinitialisation de mot de passe.
 * Body : { "email": "..." }
 *
 * Répond TOUJOURS { ok: true } (même si l'email n'existe pas) pour ne pas
 * révéler quels comptes existent. Si un compte existe, un lien unique et
 * expirant (1h) est envoyé par email ; seul son empreinte SHA-256 est stockée.
 */
router.post("/reset-demand", limiterAuth, async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ ok: false, code: "CHAMPS_MANQUANTS", message: "email est requis" });
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      // Anti-énumération : même réponse que si le compte existait.
      return res.json({ ok: true, emailEnvoye: false, message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        resetTokenHash: sha256Hex(token),
        resetTokenExpire: new Date(Date.now() + DUREE_LIEN_RESET_MS),
      },
    });

    const lien = `${urlDashboard()}/reinitialisation?token=${token}&email=${encodeURIComponent(admin.email)}`;
    let emailEnvoye = true;
    try {
      await envoyerEmailSimple({
        to: admin.email,
        sujet: "Réinitialisation de votre mot de passe — RSI",
        texte: [
          `Bonjour,`,
          ``,
          `Vous avez demandé la réinitialisation de votre mot de passe RSI.`,
          `Cliquez sur ce lien (valable 1 heure) :`,
          ``,
          `${lien}`,
          ``,
          `Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
          `L'équipe technique RSI.`,
        ].join("\n"),
      });
    } catch (err) {
      console.error("[AUTH/RESET_DEMAND/EMAIL]", err);
      emailEnvoye = false;
    }

    return res.json({
      ok: true,
      emailEnvoye,
      message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.",
    });
  } catch (err) {
    console.error("[AUTH/RESET_DEMAND]", err);
    return res.status(500).json({ ok: false, code: "ERREUR_INTERNE", message: "Une erreur interne est survenue" });
  }
});

/**
 * POST /api/auth/reset   (PUBLIC)
 * Pose un nouveau mot de passe grâce au lien reçu par email.
 * Body : { "token": "...", "motDePasse": "..." }
 * Le token doit être valide et non expiré ; un seul usage (supprimé ensuite).
 * Remet aussi à zéro les tentatives et le blocage éventuel.
 */
router.post("/reset", async (req, res) => {
  try {
    const token = String(req.body?.token ?? "").trim();
    const motDePasse = String(req.body?.motDePasse ?? "");

    if (!token || !motDePasse) {
      return res.status(400).json({ ok: false, code: "CHAMPS_MANQUANTS", message: "token et motDePasse sont requis" });
    }
    if (motDePasse.length < 8) {
      return res.status(400).json({ ok: false, code: "MOT_DE_PASSE_TROP_COURT", message: "Le mot de passe doit faire au moins 8 caractères" });
    }

    const admin = await prisma.admin.findFirst({
      where: {
        resetTokenHash: sha256Hex(token),
        resetTokenExpire: { gt: new Date() },
      },
    });

    if (!admin) {
      return res.status(400).json({ ok: false, code: "LIEN_INVALIDE_OU_EXPIRE", message: "Ce lien de réinitialisation est invalide ou a expiré. Faites une nouvelle demande." });
    }

    if (!admin.actif) {
      return res.status(403).json({ ok: false, code: "COMPTE_DESACTIVE", message: "Ce compte a été désactivé. Contactez un super administrateur." });
    }

    const nouveauHash = await bcrypt.hash(motDePasse, 10);
    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        motDePasse: nouveauHash,
        resetTokenHash: null,
        resetTokenExpire: null,
        tentativesEchouees: 0,
        bloqueJusqua: null,
      },
    });

    return res.json({ ok: true, message: "Mot de passe réinitialisé. Vous pouvez vous connecter." });
  } catch (err) {
    console.error("[AUTH/RESET]", err);
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