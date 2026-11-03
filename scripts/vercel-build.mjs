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

// 1bis) Migrations de la base de production.
//       Sans cette étape, un déploiement qui ajoute une colonne (ex.
//       Admin.nom/Admin.prenom) casse l'API tant que la migration n'a pas été
//       appliquée à la main. On utilise DIRECT_URL (session pooler, port 5432)
//       car le transaction pooler ne gère pas les verrous de migration ; à
//       défaut on retombe sur DATABASE_URL.
//
//       Un échec n'interrompt PAS le déploiement : le code applicatif tolère
//       les colonnes nom/prenom absentes (voir backend/src/lib/adminCompat.js).
//       On garde une trace très visible dans les logs Vercel.
function appliquerMigrations() {
  const direct = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!process.env.DATABASE_URL && !direct) {
    console.warn(
      "[vercel-build] DATABASE_URL absent : migrations Prisma ignorées."
    );
    return;
  }

  console.log("\n[vercel-build] Application des migrations Prisma…");
  try {
    execSync("npx prisma migrate deploy", {
      cwd: path.join(RACINE, "backend"),
      stdio: "inherit",
      shell: true,
      timeout: 120_000,
      env: { ...process.env, DIRECT_URL: direct },
    });
    console.log("[vercel-build] Migrations Prisma à jour.");
  } catch (err) {
    console.error(
      "[vercel-build] ÉCHEC des migrations Prisma (déploiement poursuivi) :",
      err?.message || err
    );
    console.error(
      "[vercel-build] Vérifier DIRECT_URL/DATABASE_URL puis relancer : npx prisma migrate deploy"
    );
  }
}
appliquerMigrations();

// 2) Build du dashboard Vite (VITE_API_URL vide → mêmes-origine /api/...).
run("npm run build", path.join(RACINE, "frontend/dashboard"));

// 2bis) Preload du logo, image LCP : le nom est haché par Vite, on l'injecte
// dans le index.html final pour une découverte précoce (perf / Lighthouse).
function injecterPreloadLogo(distDir) {
  const assets = path.join(distDir, "assets");
  if (!fs.existsSync(assets)) return;
  const webp = fs.readdirSync(assets).find((f) => /^rsi-logo-.+\.webp$/.test(f));
  if (!webp) return;
  const indexPath = path.join(distDir, "index.html");
  const link = `<link rel="preload" as="image" type="image/webp" fetchpriority="high" href="/assets/${webp}" />`;
  let html = fs.readFileSync(indexPath, "utf8");
  if (html.includes(link)) return; // déjà injecté
  html = html.replace("</head>", `    ${link}\n  </head>`);
  fs.writeFileSync(indexPath, html);
  console.log(`[vercel-build] Preload logo injecté -> /assets/${webp}`);
}
injecterPreloadLogo(path.join(RACINE, "frontend/dashboard/dist"));

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