import jwt from "jsonwebtoken";

/**
 * Middleware d'authentification admin.
 * Lit l'en-tête "Authorization: Bearer <token>" et vérifie le JWT.
 * En cas de succès, attache `req.admin` = { id, role } de l'admin connecté.
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
    // Le rôle est embarqué dans le token (voir sign dans auth.routes.js).
    // On le remet sur req.admin pour les contrôles requireRole.
    req.admin = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({
      ok: false,
      code: "AUTH_INVALIDE",
      message: "Token invalide ou expiré",
    });
  }
}

/**
 * Middleware de contrôle de rôle, à chaîner APRÈS requireAuth.
 * N'autorise que les rôles listés (ex: requireRole("SUPER_ADMIN")).
 * Hierarchie : SUPER_ADMIN > ADMIN > LECTEUR (superiorité implicite modulo
 * le tableau passé).
 */
export function requireRole(...rolesAutorises) {
  return (req, res, next) => {
    const role = req.admin?.role;
    if (!role || !rolesAutorises.includes(role)) {
      return res.status(403).json({
        ok: false,
        code: "ACCES_REFUSE",
        message: "Accès refusé : rôle insuffisant",
      });
    }
    return next();
  };
}
