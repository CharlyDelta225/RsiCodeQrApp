import crypto from "node:crypto";
import prisma from "./prisma.js";

/**
 * Génère un matricule unique court (format "RSI-XXXX") et vérifie en base
 * qu'il n'est pas déjà pris. Réservé à l'usage serveur (routes + scripts).
 */
export async function genererMatricule() {
  for (let essai = 0; essai < 10; essai++) {
    const matricule = "RSI-" + crypto.randomBytes(2).toString("hex").toUpperCase();
    const existe = await prisma.ouvrier.findUnique({ where: { matricule } });
    if (!existe) return matricule;
  }
  throw new Error("Impossible de générer un matricule unique");
}