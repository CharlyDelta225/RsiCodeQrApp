// Garde-fou chargé AVANT les tests (node --test --import ./tests/garde-base.js).
//
// Les tests d'intégration créent, modifient, bloquent et suppriment des comptes
// admin : ils ne doivent JAMAIS tourner sur la base de production partagée
// (Supabase). Ordre de chargement :
//   1. backend/.env.test s'il existe (base de test dédiée) ;
//   2. sinon backend/.env (comme avant).
// Si l'URL pointe vers une base distante (Supabase), les tests sont refusés,
// sauf dérogation explicite AUTORISER_TESTS_BASE_DISTANTE=1 (base de test
// distante dédiée, jamais la prod).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fichierTest = path.join(racine, ".env.test");

if (fs.existsSync(fichierTest)) {
  // override : les valeurs de .env.test priment ; le dotenv.config() de app.js
  // ne les écrasera pas (il ne remplace jamais une variable déjà définie).
  dotenv.config({ path: fichierTest, override: true, quiet: true });
  // schema.prisma exige DIRECT_URL : en local, la même URL suffit.
  if (!process.env.DIRECT_URL) process.env.DIRECT_URL = process.env.DATABASE_URL;
} else {
  dotenv.config({ path: path.join(racine, ".env"), quiet: true });
}

const url = process.env.DATABASE_URL || "";
let hote = "";
try {
  hote = new URL(url).hostname;
} catch {
  // URL absente ou invalide : Prisma signalera l'erreur lui-même.
}

const distante = /supabase\.(com|co)$/i.test(hote);
if (distante && process.env.AUTORISER_TESTS_BASE_DISTANTE !== "1") {
  console.error(
    `\n[tests] REFUSÉ : DATABASE_URL pointe vers une base distante (${hote}).\n` +
      "Les tests écrivent en base (comptes admin, blocages) : ils ne doivent pas\n" +
      "tourner sur la base de production partagée.\n" +
      "→ Créez backend/.env.test avec une base locale, par exemple :\n" +
      '  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rsi_code_qr_test?schema=public"\n' +
      "  puis appliquez les migrations sur cette base :\n" +
      '  DATABASE_URL="<url de test>" DIRECT_URL="<url de test>" npx prisma migrate deploy\n' +
      "→ Base de test distante dédiée (jamais la prod) : AUTORISER_TESTS_BASE_DISTANTE=1\n"
  );
  process.exit(1);
}
