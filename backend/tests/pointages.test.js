import { test, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma.js";

process.env.AUTH_RATE_LIMIT_MAX = "200";
process.env.SMTP_HOST = "";

let app;
let serveur;
let baseURL;
const emailsCrees = [];
const ouvriersCrees = [];

async function creerAdmin(role) {
  const email = `pointages-${role.toLowerCase()}-${Date.now()}@test.dev`;
  const hash = await bcrypt.hash("MotDePasse123!", 10);
  await prisma.admin.create({ data: { email, motDePasse: hash, role } });
  emailsCrees.push(email);
  const r = await fetch(`${baseURL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, motDePasse: "MotDePasse123!" }),
  });
  const b = await r.json();
  assert.ok(b.token, `login ${role}`);
  return { headers: { Authorization: `Bearer ${b.token}` } };
}

before(async () => {
  ({ default: app } = await import("../src/app.js"));
  serveur = app.listen(0);
  baseURL = `http://127.0.0.1:${serveur.address().port}`;
});

after(async () => {
  serveur?.close();
  if (ouvriersCrees.length) await prisma.ouvrier.deleteMany({ where: { id: { in: ouvriersCrees } } });
  if (emailsCrees.length) await prisma.admin.deleteMany({ where: { email: { in: emailsCrees } } });
  await prisma.$disconnect();
});

test("en-têtes de sécurité présents sur toutes les réponses", async () => {
  const r = await fetch(`${baseURL}/api/health`);
  assert.strictEqual(r.headers.get("x-content-type-options"), "nosniff");
  assert.strictEqual(r.headers.get("x-frame-options"), "DENY");
  assert.ok(r.headers.get("referrer-policy"));
  assert.strictEqual(r.headers.get("x-powered-by"), null);
});

test("GET /api/pointages/stats : compteurs exacts et série complète", async () => {
  const admin = await creerAdmin("LECTEUR");
  const r = await fetch(`${baseURL}/api/pointages/stats?jours=7`, admin);
  assert.strictEqual(r.status, 200);
  const b = await r.json();
  assert.strictEqual(b.ok, true);
  assert.strictEqual(b.ouvriers.total, await prisma.ouvrier.count());
  assert.strictEqual(b.ouvriers.actifs, await prisma.ouvrier.count({ where: { actif: true } }));
  assert.strictEqual(b.departements, await prisma.departement.count());
  assert.strictEqual(b.parJour.length, 7, "un point par jour, jours vides compris");
  assert.strictEqual(b.parJour.at(-1).date, b.jour, "la série se termine aujourd'hui");
  assert.strictEqual(b.presentsAuj, b.pointagesAuj.length);
});

test("GET /api/pointages/export : CSV complet pour un ADMIN, refusé à un LECTEUR", async () => {
  // Un pointage du jour pour avoir au moins une ligne.
  const ouvrier = await prisma.ouvrier.create({
    data: { matricule: `TEST-EXP-${Date.now()}`, nom: "EXPORT", prenom: "Test" },
  });
  ouvriersCrees.push(ouvrier.id);
  const aujISO = new Date().toISOString().slice(0, 10);
  await prisma.pointage.create({
    data: { ouvrierId: ouvrier.id, jour: new Date(`${aujISO}T00:00:00.000Z`) },
  });

  const lecteur = await creerAdmin("LECTEUR");
  const refus = await fetch(`${baseURL}/api/pointages/export?du=${aujISO}&au=${aujISO}`, lecteur);
  assert.strictEqual(refus.status, 403);

  const admin = await creerAdmin("ADMIN");
  const r = await fetch(`${baseURL}/api/pointages/export?du=${aujISO}&au=${aujISO}`, admin);
  assert.strictEqual(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/csv/);
  // Octets bruts : text() retirerait le BOM au décodage.
  const octets = Buffer.from(await r.arrayBuffer());
  assert.deepStrictEqual([...octets.subarray(0, 3)], [0xef, 0xbb, 0xbf], "BOM UTF-8 attendu (Excel)");
  const csv = octets.subarray(3).toString("utf8");
  assert.ok(csv.startsWith("Date;Heure;Matricule"), "en-tête attendu");
  assert.ok(csv.includes(ouvrier.matricule));

  // Filtre jour de la semaine appliqué en base : un autre jour exclut la ligne.
  const autreJour = (new Date(`${aujISO}T00:00:00.000Z`).getUTCDay() + 1) % 7;
  const filtre = await fetch(
    `${baseURL}/api/pointages?du=${aujISO}&au=${aujISO}&jourSemaine=${autreJour}`,
    admin
  );
  assert.strictEqual((await filtre.json()).total, 0);
});

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dashboardBuild =
  fs.existsSync(path.join(racine, "../frontend/dashboard/dist/index.html")) ||
  fs.existsSync(path.join(racine, "public/dashboard/index.html"));

test("dashboard : route connue 200, adresse inconnue 404 (même page)", { skip: !dashboardBuild && "dashboard non buildé" }, async () => {
  const ok = await fetch(`${baseURL}/rapports`);
  assert.strictEqual(ok.status, 200);
  const ko = await fetch(`${baseURL}/page-qui-n-existe-pas`);
  assert.strictEqual(ko.status, 404);
  assert.match(ko.headers.get("content-type"), /text\/html/);
});
