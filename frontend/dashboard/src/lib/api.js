import { getToken, clearSession } from "./auth";

// En dev : VITE_API_URL vide → chemins relatifs "/api/..." passés par le
// proxy Vite (voir vite.config.js) vers http://localhost:3000.
// En prod : VITE_API_URL pointe directement vers l'URL Railway/Render du backend.
const API_URL = import.meta.env.VITE_API_URL || "";

/**
 * Erreur typée sur le `code` machine renvoyé par l'API (cf. docs/api-contrat.md :
 * "c'est sur eux que le front fait ses branchements, pas sur les messages").
 * `data` = corps complet de la réponse (contient par ex. `reste` pour les
 * tentatives de connexion restantes).
 */
export class ApiError extends Error {
  constructor(message, code, status, data = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

async function request(path, options = {}) {
  const token = getToken();
  const estFormData = options.body instanceof FormData;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      // FormData fixe elle-même son Content-Type (multipart + boundary) —
      // le forcer manuellement casserait l'upload.
      ...(estFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  // Session expirée / invalide : on nettoie et on prévient l'appli
  // (ProtectedRoute écoute cet événement pour renvoyer vers /login).
  if (res.status === 401) {
    clearSession();
    window.dispatchEvent(new CustomEvent("rsi:unauthorized"));
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    // Réponse binaire (ex : PNG du badge) — l'appelant gère le blob lui-même.
    if (!res.ok) {
      throw new ApiError(`Erreur ${res.status}`, "ERREUR_INTERNE", res.status);
    }
    return res.blob();
  }

  const body = await res.json();

  if (!res.ok || body.ok === false) {
    throw new ApiError(body.message || `Erreur ${res.status}`, body.code || "ERREUR_INCONNUE", res.status, body);
  }

  return body;
}

export const api = {
  // Auth
  login: (email, motDePasse) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, motDePasse }) }),
  register: (email, motDePasse) =>
    request("/api/auth/register", { method: "POST", body: JSON.stringify({ email, motDePasse }) }),
  me: () => request("/api/auth/me"),
  // Récupération de mot de passe oublié (public).
  // POST /api/auth/reset-demand { email } → toujours { ok, emailEnvoye }.
  // POST /api/auth/reset { token, motDePasse } → valide le lien reçu par email.
  demanderResetEmail: (email) =>
    request("/api/auth/reset-demand", { method: "POST", body: JSON.stringify({ email }) }),
  effectuerReset: (token, motDePasse) =>
    request("/api/auth/reset", { method: "POST", body: JSON.stringify({ token, motDePasse }) }),

  // Gestion des comptes admin — réservée au SUPER_ADMIN (403 ACCES_REFUSE sinon).
  // La création envoie le mot de passe par email ; si l'envoi échoue, la
  // réponse contient `motDePasseTemporaire` (à transmettre à la main).
  getAdmins: () => request("/api/admins"),
  creerAdmin: (email, role) =>
    request("/api/admins", { method: "POST", body: JSON.stringify({ email, role }) }),
  changerRoleAdmin: (id, role) =>
    request(`/api/admins/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
  activerAdmin: (id) => request(`/api/admins/${id}/activer`, { method: "PATCH" }),
  desactiverAdmin: (id) => request(`/api/admins/${id}/desactiver`, { method: "PATCH" }),
  debloquerAdmin: (id) => request(`/api/admins/${id}/debloquer`, { method: "PATCH" }),
  reinitialiserMdpAdmin: (id) =>
    request(`/api/admins/${id}/reinitialiser-mot-de-passe`, { method: "POST" }),
  supprimerAdmin: (id) => request(`/api/admins/${id}`, { method: "DELETE" }),

  // Ouvriers
  getOuvriers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/ouvriers${qs ? `?${qs}` : ""}`);
  },
  getOuvrier: (id) => request(`/api/ouvriers/${id}`),
  createOuvrier: (data) => request("/api/ouvriers", { method: "POST", body: JSON.stringify(data) }),
  updateOuvrier: (id, data) => request(`/api/ouvriers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteOuvrier: (id) => request(`/api/ouvriers/${id}`, { method: "DELETE" }),
  // Route protégée par JWT : impossible d'utiliser <img src="..."> directement
  // (pas d'en-tête Authorization sur une balise <img>). On récupère le PNG en
  // blob authentifié, l'appelant fait URL.createObjectURL(blob) pour l'afficher.
  getOuvrierBadgeBlob: (id) => request(`/api/ouvriers/${id}/badge`),
  // Import en masse depuis un fichier .csv/.xlsx (colonnes Nom/Prénom/Département,
  // Matricule généré automatiquement). Réponse réelle du backend :
  // { ok, creees, ignorees, erreurs, detail: [{nom, prenom, departement, matricule?, statut, raison?}] }
  importOuvriers: (fichier) => {
    const formData = new FormData();
    formData.append("fichier", fichier);
    return request("/api/ouvriers/import", { method: "POST", body: formData });
  },
  // ZIP de tous les badges (ouvriers actifs par défaut) — pour impression en masse.
  getBadgesZipBlob: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/ouvriers/badges/zip${qs ? `?${qs}` : ""}`);
  },

  // Pointages
  getPointages: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/pointages${qs ? `?${qs}` : ""}`);
  },

  // Départements
  getDepartements: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/departements${qs ? `?${qs}` : ""}`);
  },
  getDepartement: (id) => request(`/api/departements/${id}`),
  // PATCH /api/departements/:id/membres/:ouvrierId — change le poste d'un membre.
  // Rôles : RESPONSABLE, ADJOINT, SECRETAIRE, MEMBRE. 409 POSTE_DEJA_PRIS si le
  // département a déjà un responsable (resp.) ou un adjoint.
  changerRoleMembre: (departementId, ouvrierId, roleDansDepartement) =>
    request(`/api/departements/${departementId}/membres/${ouvrierId}`, {
      method: "PATCH",
      body: JSON.stringify({ roleDansDepartement }),
    }),
  retirerMembre: (departementId, ouvrierId) =>
    request(`/api/departements/${departementId}/membres/${ouvrierId}`, { method: "DELETE" }),
  // CRUD département (POST → 409 DEPARTEMENT_EXISTANT si nom déjà pris)
  createDepartement: (data) => request("/api/departements", { method: "POST", body: JSON.stringify(data) }),
  updateDepartement: (id, data) => request(`/api/departements/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteDepartement: (id) => request(`/api/departements/${id}`, { method: "DELETE" }),

  // Santé (public, pas de token nécessaire mais request() n'en ajoute pas si absent)
  health: () => request("/api/health"),

  // Rapports de pointage
  // GET /api/rapports/journalier?date=YYYY-MM-DD&departementId=<id>
  // Retourne { ok, rapport: { dateISO, jourLabel, seuilTexte, notePresence, programme,
  //   departements: [{ id, nom, presents, absents, effectif,
  //                    lignes: [{ matricule, nom, prenom, present, heure }] }],
  //   recap: { presents, absents, effectif } } }
  getRapportJournalier: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/rapports/journalier${qs ? `?${qs}` : ""}`);
  },
  // POST /api/rapports/journalier — génère les PDF et les envoie par email.
  // Body : { date?: "YYYY-MM-DD", destinataires?: string[] }
  // Réponse : { ok, rapport, email: { destinataires, messageId } }
  envoyerRapportJournalier: (data = {}) =>
    request("/api/rapports/journalier", { method: "POST", body: JSON.stringify(data) }),
};
