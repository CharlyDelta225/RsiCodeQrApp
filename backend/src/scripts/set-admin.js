import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";

const email = process.env.ADMIN_EMAIL;
const motDePasse = process.env.ADMIN_PASSWORD;

const hash = await bcrypt.hash(motDePasse, 10);
const admin = await prisma.admin.upsert({
  where: { email },
  update: { motDePasse: hash, role: "SUPER_ADMIN", actif: true, tentativesEchouees: 0, bloqueJusqua: null },
  create: { email, motDePasse: hash, role: "SUPER_ADMIN" },
});
console.log(`[set-admin] ${admin.email} → ${admin.role} (${admin.id})`);
await prisma.$disconnect();