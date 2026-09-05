import crypto from "node:crypto";
import prisma from "./prisma.js";

/**
 * Génère un matricule unique court (format "RSI-XXXX").
 * Réservé à l'usage serveur (routes + scripts).
 */
function nouveauMatricule() {
  return "RSI-" + crypto.randomBytes(2).toString("hex").toUpperCase();
}

/**
 * Génère un matricule a priori unique et vérifie en base qu'il n'est pas déjà pris.
 */
export async function genererMatricule() {
  for (let essai = 0; essai < 10; essai++) {
    const matricule = nouveauMatricule();
    const existe = await prisma.ouvrier.findUnique({ where: { matricule } });
    if (!existe) return matricule;
  }
  throw new Error("Impossible de générer un matricule unique");
}

/**
 * Crée un ouvrier avec un matricule auto-généré, en relançant la création en
 * cas de collision sur la contrainte unique (@unique matricule, erreur P2002).
 * Nécessaire car la vérification "findUnique" puis "create" n'est pas
 * atomique : deux requêtes simultanées peuvent tirer le même matricule.
 *
 * @param {object} donnees  champs de l'ouvrier SANS matricule
 * @returns l'ouvrier créé
 */
export async function creerAvecMatricule(donnees) {
  for (let essai = 0; essai < 10; essai++) {
    try {
      return await prisma.ouvrier.create({
        data: { ...donnees, matricule: nouveauMatricule() },
      });
    } catch (err) {
      // Cas limite courant : un concurrent a pris exactement notre matricule.
      if (err.code !== "P2002") throw err;
    }
  }
  throw new Error("Impossible de générer un matricule unique");
}