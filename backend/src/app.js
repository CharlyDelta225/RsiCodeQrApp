import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import badgeageRoutes from "./routes/badgeage.routes.js";
import ouvriersRoutes from "./routes/ouvriers.routes.js";
import pointagesRoutes from "./routes/pointages.routes.js";
import authRoutes from "./routes/auth.routes.js";
import requireAuth from "./middleware/auth.middleware.js";

dotenv.config();

const app = express();

// Middlewares globaux
app.use(cors()); // autorise le terminal (mode kiosque) et le dashboard à appeler l'API
app.use(express.json()); // parse le body JSON des requêtes

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

// CRUD ouvriers (utilisé par le dashboard) — PROTÉGÉ (JWT admin requis)
app.use("/api/ouvriers", requireAuth, ouvriersRoutes);

// Historique des pointages (dashboard) — PROTÉGÉ (JWT admin requis)
app.use("/api/pointages", requireAuth, pointagesRoutes);

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
  console.error("[ERREUR]", err);
  res.status(500).json({
    ok: false,
    code: "ERREUR_INTERNE",
    message: "Une erreur interne est survenue",
  });
});

export default app;