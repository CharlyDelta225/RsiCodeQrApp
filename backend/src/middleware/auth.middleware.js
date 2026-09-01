import jwt from "jsonwebtoken";

/**
 * Middleware d'authentification admin.
 * Lit l'en-tête "Authorization: Bearer <token>" et vérifie le JWT.
 * En cas de succès, attaché `req.admin` (l'id de l'admin connecté).
 */
export default function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({
      ok: false,
      code: "AUTH_REQUISE",
      message: "Token d'authentification manquant",
    });
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = { id: payload.sub };
    return next();
  } catch {
    return res.status(401).json({
      ok: false,
      code: "AUTH_INVALIDE",
      message: "Token invalide ou expiré",
    });
  }
}