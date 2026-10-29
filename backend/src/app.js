import express from "express";
import dotenv from "dotenv";
import path from "path";
import fs from "node:fs";
import { fileURLToPath } from "url";

import badgeageRoutes from "./routes/badgeage.routes.js";
import ouvriersRoutes from "./routes/ouvriers.routes.js";
import pointagesRoutes from "./routes/pointages.routes.js";
import authRoutes from "./routes/auth.routes.js";
import requireAuth from "./middleware/auth.middleware.js";
import importRoutes from "./routes/import.routes.js";
import adminsRoutes from "./routes/admins.routes.js";
import departementsRoutes from "./routes/departements.routes.js";
import rapportsRoutes from "./routes/rapports.routes.js";
import cronRoutes from "./routes/cron.routes.js";
import logger from "./lib/logger.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Derrière un proxy (Vercel, ngrok, reverse proxy), Express doit faire
// confiance au 1er proxy pour résoudre l'IP cliente (req.ip) — sinon
// express-rate-limit lève ERR_ERL_UNEXPECTED_X_FORWARDED_FOR sur Vercel.
app.set("trust proxy", 1);
app.disable("x-powered-by"); // ne pas annoncer la techno serveur

// En-têtes de sécurité sur toutes les réponses (dashboard, terminal, API) :
//  - nosniff : le navigateur respecte le Content-Type déclaré ;
//  - pas d'affichage dans une iframe d'un autre site (anti-clickjacking) ;
//  - Referrer limité à l'origine vers les autres sites ;
//  - caméra autorisée pour ce site seulement (terminal de scan), micro et
//    géolocalisation refusés.
// (Pas de CSP complète : le terminal utilise des scripts en ligne.)
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
});

// Middlewares globaux
// CORS restreint : seules les origines du dashboard sont acceptées. Le
// terminal, servi par le backend lui-même, appelle l'API en MÊME origine
// (local, LAN, ngrok) : on accepte donc toujours la même origine que l'hôte.
// Liste par défaut = dev Vite ; en production, la surcharger via CORS_ORIGINES.
const originesAutorisees = (() => {
  const liste = process.env.CORS_ORIGINES
    ? process.env.CORS_ORIGINES.split(",").map((s) => s.trim()).filter(Boolean)
    : [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
      ];
  // L'origine publique du backend couvre aussi le terminal servi par l'API
  // en production (même hôte que le dashboard si celui-ci n'a pas son domaine).
  if (process.env.PUBLIC_BASE_URL) {
    try {
      const originePublique = new URL(process.env.PUBLIC_BASE_URL).origin;
      if (!liste.includes(originePublique)) liste.push(originePublique);
    } catch {
      /* PUBLIC_BASE_URL invalide : on l'ignore */
    }
  }
  return liste;
})();

app.use((req, res, next) => {
  const origine = req.headers.origin;
  if (!origine) return next(); // curl, tests, tâches serveur : pas d'en-tête Origin

  const memeOrigine = origine === `${req.protocol}://${req.get("host")}`;
  if (!memeOrigine && !originesAutorisees.includes(origine)) {
    return res.status(403).json({
      ok: false,
      code: "ORIGINE_NON_AUTORISEE",
      message: "Origine non autorisée",
    });
  }

  res.setHeader("Access-Control-Allow-Origin", origine);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");

  // Pré-requête CORS : on répond 204 sans passer par les routes.
  if (req.method === "OPTIONS") return res.sendStatus(204);

  return next();
});
app.use(express.json({ limit: "100kb" })); // parse le body JSON des requêtes

// --- Logging HTTP : une ligne par requête (débogage) ---
// Ajoute un requestId corrélable (et renvoyé dans l'en-tête X-Request-Id),
// puis loggue méthode, chemin, status, durée et IP. Sortie console capturée
// par Vercel en prod ; fichier backend/logs/ sinon.
app.use((req, res, next) => {
  req.requestId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  res.setHeader("X-Request-Id", req.requestId);
  const debut = Date.now();
  res.on("finish", () => {
    logger.info(`[HTTP] ${req.method} ${req.originalUrl || req.url}`, {
      requestId: req.requestId,
      status: res.statusCode,
      dureeMs: Date.now() - debut,
      ip: req.ip,
      admin: req.admin?.id ?? null,
    });
  });
  return next();
});

// --- Terminal de scan (kiosque) ---
// Servi par le backend lui-même (et non un serveur statique séparé) car
// terminal.html appelle l'API via `window.location.origin` : il doit donc
// être chargé depuis la même origine que l'API, que ce soit en local
// (http://localhost:3000/terminal), sur le réseau local, ou via ngrok.
// En local, le terminal vit dans frontend/terminal ; sur Vercel (Root
// Directory = backend), scripts/vercel-prep.mjs le copie dans public/terminal.
const cheminsTerminal = [
  path.join(__dirname, "../../frontend/terminal"), // dev / repo monorepo
  path.join(__dirname, "../public/terminal"), // Vercel (après vercel-prep)
];
const TERMINAL_DIR = cheminsTerminal.find((p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } }) ?? cheminsTerminal[0];
app.use("/terminal", express.static(TERMINAL_DIR));

// --- Dashboard admin (SPA React) ---
// Servi par le backend lui-même (MÊME ORIGINE que l'API) : VITE_API_URL y est
// laissé vide, le dashboard appelle /api/... en relatif → zéro CORS en prod.
// Sur Vercel, scripts/vercel-build.mjs copie le build Vite (dist/) dans
// public/dashboard ; en dev, le dashboard tourne via le serveur Vite (:5174)
// et ce dossier sert de fallback s'il a été buildé localement.
const cheminsDashboard = [
  path.join(__dirname, "../../frontend/dashboard/dist"), // dev / repo monorepo
  path.join(__dirname, "../public/dashboard"), // Vercel (après vercel-build)
];
const DASHBOARD_DIR = cheminsDashboard.find((p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } });

if (DASHBOARD_DIR) {
  app.use(express.static(DASHBOARD_DIR));
}

// --- Routes publiques ---
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "RsiCodeQrApp API",
    time: new Date().toISOString(),
  });
});

// Contrat API badgeage (utilisé par le terminal) — voir routes/badgeage.routes.js
// RESTE PUBLIC : le terminal badge sans se connecter.
app.use("/api/badgeage", badgeageRoutes);

// Authentification admin — voir routes/auth.routes.js
app.use("/api/auth", authRoutes);

// Gestion des comptes admin (rôles) — PROTÉGÉ SUPER_ADMIN (voir routes/admins.routes.js)
app.use("/api/admins", requireAuth, adminsRoutes);

// CRUD ouvriers (utilisé par le dashboard) — PROTÉGÉ (JWT admin requis)
app.use("/api/ouvriers", requireAuth, ouvriersRoutes);

// Import massif d'ouvriers (.csv/.xlsx) + génération QR — PROTÉGÉ
app.use("/api/ouvriers", requireAuth, importRoutes);

// Historique des pointages (dashboard) — PROTÉGÉ (JWT admin requis)
app.use("/api/pointages", requireAuth, pointagesRoutes);

// Gestion des départements + affectation ouvriers — PROTÉGÉ (JWT admin requis)
app.use("/api/departements", requireAuth, departementsRoutes);

// Rapports de pointage + envoi programmé — PROTÉGÉ (ADMIN/SUPER_ADMIN)
app.use("/api/rapports", requireAuth, rapportsRoutes);

// Cron Vercel (envoi automatique J+1) — publique mais protégée par CRON_SECRET
app.use("/api/cron", cronRoutes);

// --- Fallback SPA du dashboard (BrowserRouter) ---
// Toute requête GET non-API et non-terminal reçoit index.html pour que React
// Router gère la route côté client. Placé AVANT le 404 JSON.
// Les routes connues du dashboard répondent 200 ; toute autre adresse reçoit
// la même page (qui affiche « Page introuvable ») mais avec un vrai statut 404,
// pour que les moteurs de recherche ne l'indexent pas (« soft 404 »).
// À tenir à jour avec les <Route> de frontend/dashboard/src/App.jsx.
const ROUTES_DASHBOARD = new Set([
  "/", "/login", "/inscription", "/oublie", "/reinitialisation",
  "/confidentialite", "/cgv-cgu",
  "/ouvriers", "/badges", "/badges/atelier", "/pointages", "/historique",
  "/departements", "/gestion-departements", "/migration-ouvrier",
  "/rapports", "/gestion-admins",
]);
if (DASHBOARD_DIR) {
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api") || req.path.startsWith("/terminal")) return next();
    const chemin = req.path.length > 1 ? req.path.replace(/\/+$/, "") : req.path;
    if (!ROUTES_DASHBOARD.has(chemin)) res.status(404);
    return res.sendFile(path.join(DASHBOARD_DIR, "index.html"));
  });
}

// --- 404 : toute route non déclarée ---
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    code: "ROUTE_INCONNUE",
    message: `Route ${req.method} ${req.path} introuvable`,
  });
});

// --- Gestion centralisée des erreurs ---
// Ne JAMAIS renvoyer la stack technique au client.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  // 413 : corps JSON trop gros (express.json limit)
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      ok: false,
      code: "CORPS_TROP_GROS",
      message: "La requête est trop volumineuse",
    });
  }

  // 400 : JSON malformé envoyé par un client (corps invalide).
  if (err.type === "entity.parse.failed" || err.status === 400) {
    return res.status(400).json({
      ok: false,
      code: "CORPS_INVALIDE",
      message: "Corps de requête invalide",
    });
  }

  // 413 : fichier import trop lourd (multer limits.fileSize)
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      ok: false,
      code: "FICHIER_TROP_GROS",
      message: "Le fichier dépasse la taille maximale autorisée (5 Mo)",
    });
  }

  // 403 : origine refusée par le filtre CORS (renvoyé directement par le
  // middleware dédié, aucun passage ici).

  logger.error("[API] Erreur interne", {
    requestId: req.requestId,
    erreur: err,
  });
  res.status(500).json({
    ok: false,
    code: "ERREUR_INTERNE",
    message: "Une erreur interne est survenue",
  });
});

export default app;