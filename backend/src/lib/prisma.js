import { PrismaClient } from "@prisma/client";

// Singleton Prisma Client — un seul réutilisé par toute l'application.
// En dev, on évite de créer un client par requête (records exhaustés, lenteurs).
const prisma = new PrismaClient();

export default prisma;