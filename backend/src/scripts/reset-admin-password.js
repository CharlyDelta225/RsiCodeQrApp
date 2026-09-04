import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";

// Force la création OU la mise à jour du compte admin avec les valeurs
// actuelles de .env (contrairement au seed, celui-ci met bien à jour le
// mot de passe même si le compte existait déjà avec une autre valeur).
// Usage : node src/scripts/reset-admin-password.js

async function main() {
  const email = String(process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const motDePasse = process.env.ADMIN_PASSWORD;

  if (!email || !motDePasse) {
    throw new Error("ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis dans .env");
  }

  const hash = await bcrypt.hash(motDePasse, 10);

  const admin = await prisma.admin.upsert({
    where: { email },
    update: { motDePasse: hash }, // <-- la vraie différence avec seed.js
    create: { email, motDePasse: hash },
  });

  console.log(`✓ Mot de passe admin réinitialisé pour : ${admin.email}`);
  console.log(`  Utilise maintenant : ${email} / ${motDePasse}`);
}

main()
  .catch((e) => {
    console.error("Erreur :", e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
