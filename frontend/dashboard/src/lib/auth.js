// Stockage du token JWT admin (localStorage — suffisant pour un dashboard
// interne ; à revoir si un jour on expose ça publiquement).
const TOKEN_KEY = "rsi_token";
const ADMIN_KEY = "rsi_admin";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getAdmin() {
  const raw = localStorage.getItem(ADMIN_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setSession(token, admin) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
}

export function isAuthenticated() {
  return !!getToken();
}
