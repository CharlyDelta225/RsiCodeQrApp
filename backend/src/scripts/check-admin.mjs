import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";

const email = process.argv[2] || "admin@rsi-eglise.dev";
const candidat = process.argv[3];

const admin = await prisma.admin.findUnique({ where: { email } });
if (!admin) {
  console.log("[check] aucun admin", email);
  process.exit(1);
}
const bon = await bcrypt.compare(candidat, admin.motDePasse);
console.log(`[check] ${email} role=${admin.role} actif=${admin.actif} matche=${bon}`);
await prisma.$disconnect();