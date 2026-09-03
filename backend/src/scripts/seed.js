import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";

// Script de seed : remplit la base de données de dev avec des ouvriers d'exemple.
// Usage : npm run seed
// Idempotent : si un matricule existe déjà, il est ignoré (upsert).
const ouvriersExemples = [
  { matricule: "RSI-0001", nom: "KOUAME", prenom: "Aya", departement: "Louange" },
  { matricule: "RSI-0002", nom: "BAMBA", prenom: "Ibrahim", departement: "Accueil" },
  { matricule: "RSI-0003", nom: "N'GUESSAN", prenom: "Marie", departement: "Enfant" },
  { matricule: "RSI-0004", nom: "KONE", prenom: "David", departement: "Intercession" },
  { matricule: "RSI-0005", nom: "TRAORE", prenom: "Fatou", departement: "Technique", actif: false },
];

async function main() {
  let crees = 0;
  for (const o of ouvriersExemples) {
    const result = await prisma.ouvrier.upsert({
      where: { matricule: o.matricule },
      update: {},
      create: { ...o, actif: o.actif ?? true },
    });
    if (result) crees++;
  }
  const total = await prisma.ouvrier.count();
  console.log(`✓ Seed terminé. ${crees}/${ouvriersExemples.length} ouvriers traités. Total en base : ${total}`);

  // Admin par défaut (étape 7) — email/mot de passe depuis .env
  // Rôle SUPER_ADMIN : c'est le seul qui peut créer d'autres comptes admin.
  const email = process.env.ADMIN_EMAIL;
  const motDePasse = process.env.ADMIN_PASSWORD;
  if (email && motDePasse) {
    const hash = await bcrypt.hash(motDePasse, 10);
    await prisma.admin.upsert({
      where: { email },
      // update : on réaffirme le rôle SUPER_ADMIN même si le compte existe déjà
      // (il a pu être créé avant l'ajout du champ rôle, ou rétrogradé).
      update: { role: "SUPER_ADMIN" },
      create: { email, motDePasse: hash, role: "SUPER_ADMIN" },
    });
    console.log(`✓ Admin par défaut prêt : ${email} (SUPER_ADMIN)`);
  }
}

main()
  .catch((e) => {
    console.error("Erreur pendant le seed :", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });