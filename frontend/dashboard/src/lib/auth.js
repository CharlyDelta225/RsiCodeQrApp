// Stockage du token JWT admin (localStorage — suffisant pour un dashboard
// interne ; à revoir si un jour on expose ça publiquement).
const TOKEN_KEY = "rsi_token";
const ADMIN_KEY = "rsi_admin";

const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutes
let inactivityTimer = null;

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

// Déconnexion volontaire (bouton) ou forcée (inactivité)
export function logout() {
  stopInactivityWatcher();
  clearSession();
  window.dispatchEvent(new CustomEvent("rsi:unauthorized"));
}

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    logout();
  }, INACTIVITY_MS);
}

export function startInactivityWatcher() {
  stopInactivityWatcher();

  const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
  events.forEach((evt) =>
    window.addEventListener(evt, resetInactivityTimer, { passive: true })
  );

  resetInactivityTimer();
}

export function stopInactivityWatcher() {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
  events.forEach((evt) =>
    window.removeEventListener(evt, resetInactivityTimer)
  );
}