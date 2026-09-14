import dotenv from "dotenv";
dotenv.config();

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prisma from "../lib/prisma.js";
import { genererBadgePng } from "../lib/badge.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SORTIE_DIR = path.resolve(__dirname, "../../public/badges");

/**
 * Génère un fichier PNG par ouvrier actif, contenant le QR code de son matricule
 * et son nom imprimé en bas du badge.
 * Usage : npm run badges:generate
 *
 * Le QR encode UNIQUEMENT le matricule (ex: "RSI-0001") : c'est exactement
 * ce que la douchette "tape" dans le terminal. Garder le contenu identique
 * au champ matricule en base, sinon le scan échouera (BADGE_INCONNU).
 */
async function main() {
  fs.mkdirSync(SORTIE_DIR, { recursive: true });

  const ouvriers = await prisma.ouvrier.findMany({
    where: { actif: true },
    orderBy: { matricule: "asc" },
    include: { departements: { take: 1, include: { departement: true } } },
  });

  if (ouvriers.length === 0) {
    console.log("⚠ Aucun ouvrier actif : rien à générer.");
    return;
  }

  for (const o of ouvriers) {
    const fichier = path.join(SORTIE_DIR, `${o.matricule}.png`);
    const png = await genererBadgePng(o);
    fs.writeFileSync(fichier, png);
  }

  console.log(`✓ ${ouvriers.length} badge(s) généré(s) dans public/badges/ :`);
  for (const o of ouvriers) {
    console.log(`  - ${o.matricule}.png  (${o.prenom} ${o.nom} — ${o.departements[0]?.departement?.nom ?? "sans département"})`);
  }
}

main()
  .catch((e) => {
    console.error("Erreur pendant la génération :", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });