import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// URL publique du site (balises canonical/OG de index.html, robots.txt,
// sitemap.xml). Une seule source : VITE_SITE_URL, sinon l'URL de prod Vercel.
const SITE_URL_DEFAUT = "https://rsicodeqrapp.vercel.app";

// Remplace %SITE_URL% dans index.html et génère robots.txt / sitemap.xml
// à partir des modèles de seo/ (servis aussi par le serveur de dev).
function siteUrlPlugin(siteUrl) {
  const fichiersSeo = ["robots.txt", "sitemap.xml"];
  const rendre = (nom) =>
    fs.readFileSync(path.join(__dirname, "seo", nom), "utf8").replaceAll("%SITE_URL%", siteUrl);
  return {
    name: "rsi-site-url",
    // "pre" : avant l'analyse HTML de Vite, qui rejette "%SITE_URL%" dans les URL.
    transformIndexHtml: {
      order: "pre",
      handler: (html) => html.replaceAll("%SITE_URL%", siteUrl),
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const nom = req.url?.slice(1);
        if (!fichiersSeo.includes(nom)) return next();
        res.setHeader("Content-Type", nom.endsWith(".xml") ? "application/xml" : "text/plain");
        res.end(rendre(nom));
      });
    },
    generateBundle() {
      for (const nom of fichiersSeo) {
        this.emitFile({ type: "asset", fileName: nom, source: rendre(nom) });
      }
    },
  };
}

// En dev, le dashboard tourne sur :5174 et proxie /api vers le backend
// (par défaut http://localhost:3000, cf. backend/.env.example → PORT=3000).
// En prod, VITE_API_URL pointe directement vers l'URL Railway/Render du backend
// (voir src/lib/api.js) — le proxy ne sert qu'en local.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "VITE_");
  const siteUrl = (env.VITE_SITE_URL || SITE_URL_DEFAUT).replace(/\/+$/, "");
  return {
    plugins: [react(), tailwindcss(), siteUrlPlugin(siteUrl)],
    server: {
      port: 5174,
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
        },
      },
    },
    // Code-splitting : recharts (lourd, utilisé uniquement sur le dashboard) est
    // isolé dans son propre chunk ; React et le routeur forment des chunks stables
    // et mis en cache — le démarrage (login) reste ultra-léger.
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("recharts") || id.includes("/d3-") || id.includes("victory-vendor")) {
              return "charts";
            }
            if (id.includes("react-router")) return "router";
            if (
              id.includes("/react/") ||
              id.includes("/react-dom/") ||
              id.includes("scheduler") ||
              id.includes("use-sync-external-store")
            ) {
              return "react-vendor";
            }
            return "vendor";
          },
        },
      },
    },
  };
});
