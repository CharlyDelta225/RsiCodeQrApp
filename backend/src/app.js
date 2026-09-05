import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import badgeageRoutes from "./routes/badgeage.routes.js";
import ouvriersRoutes from "./routes/ouvriers.routes.js";
import pointagesRoutes from "./routes/pointages.routes.js";
import authRoutes from "./routes/auth.routes.js";
import requireAuth from "./middleware/auth.middleware.js";
import importRoutes from "./routes/import.routes.js";
import adminsRoutes from "./routes/admins.routes.js";
import departementsRoutes from "./routes/departements.routes.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

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

// --- Terminal de scan (kiosque) ---
// Servi par le backend lui-même (et non un serveur statique séparé) car
// terminal.html appelle l'API via `window.location.origin` : il doit donc
// être chargé depuis la même origine que l'API, que ce soit en local
// (http://localhost:3000/terminal), sur le réseau local, ou via ngrok.
app.use("/terminal", express.static(path.join(__dirname, "../../frontend/terminal")));

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
app.use((err, _req, res, _next) => {
  // 413 : corps JSON trop gros (express.json limit)
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      ok: false,
      code: "CORPS_TROP_GROS",
      message: "La requête est trop volumineuse",
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

  console.error("[ERREUR]", err);
  res.status(500).json({
    ok: false,
    code: "ERREUR_INTERNE",
    message: "Une erreur interne est survenue",
  });
});

export default app;