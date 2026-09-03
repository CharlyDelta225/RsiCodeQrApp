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
});
