import dotenv from "dotenv";
dotenv.config();

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prisma from "../lib/prisma.js";
import { genererMatricule } from "../lib/matricule.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Import en masse des ouvriers depuis un fichier CSV.
 * Usage :            npm run import:csv              (fichier par défaut)
 *                    npm run import:csv -- chemin.csv
 *
 * Format attendu (1re ligne = en-tête) :
 *   matricule,nom,prenom,departement,actif
 *   RSI-0001,KOUAME,Aya,Louange,true
 *
 * Règles :
 *   - matricule et actif sont optionnels (matricule auto-généré, actif=true sinon)
 *   - caractère séparateur : virgule ; guillemets doubles pour les valeurs longues
 *   - si un matricule existe déjà, l'ouvrier est mis à jour (upsert) : idéal
 *     pour les corrections et les ré-imports de liste.
 */

// Parser CSV minimal : gère champs entre guillemets (doublés "") et retours à la ligne internes.
function parserCSV(texte) {
  const lignes = [];
  let ligne = [];
  let champ = "";
  let entreGuillemets = false;

  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (entreGuillemets) {
      if (c === '"' && texte[i + 1] === '"') {
        champ += '"';
        i++;
      } else if (c === '"') {
        entreGuillemets = false;
      } else {
        champ += c;
      }
    } else if (c === '"') {
      entreGuillemets = true;
    } else if (c === ",") {
      ligne.push(champ);
      champ = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texte[i + 1] === "\n") i++;
      ligne.push(champ);
      if (ligne.some((v) => v.trim() !== "")) lignes.push(ligne);
      ligne = [];
      champ = "";
    } else {
      champ += c;
    }
  }
  if (champ !== "" || ligne.length > 0) {
    ligne.push(champ);
    if (ligne.some((v) => v.trim() !== "")) lignes.push(ligne);
  }
  return lignes;
}

function normaliserBool(valeur) {
  if (!valeur) return true;
  return !["0", "false", "non", "n"].includes(valeur.trim().toLowerCase());
}

async function main() {
  const chemin = process.argv[2] || path.join(__dirname, "../../data/ouvriers.csv");
  if (!fs.existsSync(chemin)) {
    console.error(`✗ Fichier introuvable : ${chemin}`);
    console.error("  Fournir le chemin en argument : npm run import:csv -- mon-fichier.csv");
    process.exit(1);
  }

  const texte = fs.readFileSync(chemin, "utf8");
  const lignes = parserCSV(texte);

  if (lignes.length < 2) {
    console.error("✗ Le CSV doit contenir une ligne d'en-tête et au moins un ouvrier.");
    process.exit(1);
  }

  const [enTete, ...donnees] = lignes;
  const index = Object.fromEntries(enTete.map((col, i) => [col.trim().toLowerCase(), i]));

  const champsRequis = ["nom", "prenom", "departement"];
  for (const c of champsRequis) {
    if (!(c in index)) {
      console.error(`✗ Colonne requise absente : "${c}". Lignes d'en-tête : ${enTete.join(", ")}`);
      process.exit(1);
    }
  }

  let crees = 0;
  let maj = 0;
  let erreurs = 0;

  for (const ligne of donnees) {
    try {
      const nom = String(ligne[index.nom] ?? "").trim();
      const prenom = String(ligne[index.prenom] ?? "").trim();
      const departement = String(ligne[index.departement] ?? "").trim();

      if (!nom || !prenom || !departement) {
        console.warn(`⚠ Ligne ignorée (champs vides) : ${ligne.join(", ")}`);
        erreurs++;
        continue;
      }

      const matricule = ligne[index.matricule] ? String(ligne[index.matricule]).trim() : undefined;
      const actif = ligne[index.actif] !== undefined ? normaliserBool(ligne[index.actif]) : true;

      // Matricule absent => auto-génération (comme la route POST /api/ouvriers)
      const matriculeFinal = matricule ?? (await genererMatricule());

      const existeDeja = await prisma.ouvrier.findUnique({ where: { matricule: matriculeFinal } });

      await prisma.ouvrier.upsert({
        where: { matricule: matriculeFinal },
        update: { nom, prenom, departement, actif },
        create: { matricule: matriculeFinal, nom, prenom, departement, actif },
      });

      if (existeDeja) maj++;
      else crees++;
    } catch (e) {
      console.warn(`⚠ Erreur sur la ligne : ${ligne.join(", ")} — ${e.message}`);
      erreurs++;
    }
  }

  console.log(`✓ Import terminé : ${crees} créé(s), ${maj} mis à jour, ${erreurs} en erreur/ignoré(s).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Erreur fatale :", e);
  process.exit(1);
});