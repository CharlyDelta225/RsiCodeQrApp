import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import { normaliserNomDepartement } from "../lib/normaliserDepartement.js";

// Script de seed : remplit la base avec des départements et ouvriers d'exemple.
// Usage : npm run seed
// Idempotent : si un matricule ou un département existe déjà, il est ignoré.
const departementsExemples = ["Louange", "Accueil", "Enfant", "Intercession", "Technique"];

const ouvriersExemples = [
  { matricule: "RSI-0001", nom: "KOUAME", prenom: "Aya", departement: "Louange" },
  { matricule: "RSI-0002", nom: "BAMBA", prenom: "Ibrahim", departement: "Accueil" },
  { matricule: "RSI-0003", nom: "N'GUESSAN", prenom: "Marie", departement: "Enfant" },
  { matricule: "RSI-0004", nom: "KONE", prenom: "David", departement: "Intercession" },
  { matricule: "RSI-0005", nom: "TRAORE", prenom: "Fatou", departement: "Technique", actif: false },
];

async function recupererOuCreerDepartements(noms) {
  const existants = await prisma.departement.findMany();
  const parNormalise = new Map(
    existants.map((d) => [normaliserNomDepartement(d.nom), d])
  );
  const resultats = [];
  for (const nom of noms) {
    const cle = normaliserNomDepartement(nom);
    let dept = parNormalise.get(cle);
    if (!dept) {
      dept = await prisma.departement.create({ data: { nom } });
      parNormalise.set(cle, dept);
    }
    resultats.push(dept);
  }
  return resultats;
}

async function main() {
  const departements = await recupererOuCreerDepartements(departementsExemples);
  const deptParNormalise = new Map(
    departements.map((d) => [normaliserNomDepartement(d.nom), d])
  );

  let crees = 0;
  let rattaches = 0;
  for (const o of ouvriersExemples) {
    const ouvrier = await prisma.ouvrier.upsert({
      where: { matricule: o.matricule },
      update: {},
      create: { matricule: o.matricule, nom: o.nom, prenom: o.prenom, actif: o.actif ?? true },
    });
    if (ouvrier) crees++;

    const dept = deptParNormalise.get(normaliserNomDepartement(o.departement));
    if (dept) {
      const lien = await prisma.ouvrierDepartement.upsert({
        where: { ouvrierId_departementId: { ouvrierId: ouvrier.id, departementId: dept.id } },
        update: {},
        create: { ouvrierId: ouvrier.id, departementId: dept.id, roleDansDepartement: "MEMBRE" },
      });
      if (lien) rattaches++;
    }
  }

  console.log(`✓ Seed terminé. ${departements.length} départements, ${crees}/${ouvriersExemples.length} ouvriers, ${rattaches} rattachements.`);
  console.log(`  Total ouvriers en base : ${await prisma.ouvrier.count()}`);

  // Admin par défaut — email/mot de passe depuis .env
  const email = process.env.ADMIN_EMAIL;
  const motDePasse = process.env.ADMIN_PASSWORD;
  if (email && motDePasse) {
    const hash = await bcrypt.hash(motDePasse, 10);
    await prisma.admin.upsert({
      where: { email },
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