import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { isAuthenticated, clearSession } from "../lib/auth";

/**
 * Bloque l'accès si aucun token n'est stocké, et se désabonne proprement
 * si l'API répond 401 pendant la navigation (token expiré/invalide) —
 * voir l'événement "rsi:unauthorized" émis par lib/api.js.
 */
export default function ProtectedRoute({ children }) {
  const [authed, setAuthed] = useState(isAuthenticated());

  useEffect(() => {
    function handleUnauthorized() {
      clearSession();
      setAuthed(false);
    }
    window.addEventListener("rsi:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("rsi:unauthorized", handleUnauthorized);
  }, []);

  if (!authed) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
