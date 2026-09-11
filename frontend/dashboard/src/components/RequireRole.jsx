import { Navigate } from "react-router-dom";
import { roleAdmin } from "../lib/auth";

/**
 * Bloque l'accès à une page si le rôle de l'admin connecté n'est pas dans
 * `roles` (ex : <RequireRole roles={["SUPER_ADMIN"]}>). Complète RequireRole
 * côté serveur : les endpoints renvoient de toute façon 403 ACCES_REFUSE.
 */
export default function RequireRole({ roles = [], children }) {
  const monRole = roleAdmin();
  if (!roles.includes(monRole)) {
    return <Navigate to="/" replace />;
  }
  return children;
}