import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// En dev, le dashboard tourne sur :5174 et proxie /api vers le backend
// (par défaut http://localhost:3000, cf. backend/.env.example → PORT=3000).
// En prod, VITE_API_URL pointe directement vers l'URL Railway/Render du backend
// (voir src/lib/api.js) — le proxy ne sert qu'en local.
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
});