import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(__dirname, "../");

const run = (cmd, cwd = RACINE) => {
  console.log(`\n$ ${cmd} [cwd=${cwd}]`);
  execSync(cmd, { cwd, stdio: "inherit", shell: true });
};

// 1) Dépendances des deux sous-projets + génération Prisma.
if (process.env.SKIP_INSTALL !== "1") {
  run("npm install --registry=https://registry.npmjs.org", path.join(RACINE, "backend"));
  run("npm install --registry=https://registry.npmjs.org", path.join(RACINE, "frontend/dashboard"));
}
run("npx prisma generate", path.join(RACINE, "backend"));

// 2) Build du dashboard Vite (VITE_API_URL vide → mêmes-origine /api/...).
run("npm run build", path.join(RACINE, "frontend/dashboard"));

// 3) Assemble dashboard + terminal dans backend/public (servis par Express).
const dist = path.join(RACINE, "frontend/dashboard/dist");
const dashboardDest = path.join(RACINE, "backend/public/dashboard");
fs.rmSync(dashboardDest, { recursive: true, force: true });
fs.mkdirSync(path.dirname(dashboardDest), { recursive: true });
fs.cpSync(dist, dashboardDest, { recursive: true });
console.log(`[vercel-build] Dashboard copié -> backend/public/dashboard`);

const terminalSrc = path.join(RACINE, "frontend/terminal");
const terminalDest = path.join(RACINE, "backend/public/terminal");
fs.rmSync(terminalDest, { recursive: true, force: true });
fs.cpSync(terminalSrc, terminalDest, { recursive: true });
console.log(`[vercel-build] Terminal copié -> backend/public/terminal`);

console.log("[vercel-build] Terminé.");