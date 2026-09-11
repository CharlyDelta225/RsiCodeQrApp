import { test, before, after } from "node:test";
import assert from "node:assert";
import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma.js";

process.env.AUTH_RATE_LIMIT_MAX = "200";
process.env.SMTP_HOST = ""; // aucun email réel pendant la suite

let app;
let serveur;
let baseURL;
let tokenSuper;
let idSuper;
const emailsCrees = [];

async function creerAdmin(email, motDePasse = "MotDePasse123!", role = "ADMIN") {
  const hash = await bcrypt.hash(motDePasse, 10);
  const a = await prisma.admin.create({ data: { email, motDePasse: hash, role } });
  emailsCrees.push(email);
  return a;
}

function login(email, motDePasse) {
  return fetch(`${baseURL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, motDePasse }),
  });
}

async function loginOk(email, motDePasse) {
  const r = await login(email, motDePasse);
  assert.strictEqual(r.status, 200, `login ${email}`);
  const b = await r.json();
  return b.token;
}

before(async () => {
  ({ default: app } = await import("../src/app.js"));
  serveur = app.listen(0);
  const port = serveur.address().port;
  baseURL = `http://127.0.0.1:${port}`;

  // Le compte SUPER_ADMIN du seed existe déjà (admin@example.com / change-moi).
  tokenSuper = await loginOk("admin@example.com", "change-moi");
  idSuper = (await prisma.admin.findUnique({ where: { email: "admin@example.com" } })).id;
});

after(async () => {
  serveur?.close();
  if (emailsCrees.length > 0) {
    await prisma.admin.deleteMany({ where: { email: { in: emailsCrees } } });
  }
  await prisma.$disconnect();
});

test("GET /api/admins sans token => 401 AUTH_REQUISE", async () => {
  const res = await fetch(`${baseURL}/api/admins`);
  assert.strictEqual(res.status, 401);
  const b = await res.json();
  assert.strictEqual(b.code, "AUTH_REQUISE");
});

test("GET /api/admins avec un compte LECTEUR => 403 ACCES_REFUSE (superadmin seulement)", async () => {
  const lecteur = await creerAdmin(`lecteur-${Date.now()}@test.dev`, "MotDePasse123!", "LECTEUR");
  const tokenLecteur = await loginOk(lecteur.email, "MotDePasse123!");

  const res = await fetch(`${baseURL}/api/admins`, {
    headers: { Authorization: `Bearer ${tokenLecteur}` },
  });
  assert.strictEqual(res.status, 403);
  const b = await res.json();
  assert.strictEqual(b.code, "ACCES_REFUSE");
});

test("extraction ZIP des badges : 403 pour un LECTEUR, 200 pour un ADMIN", async () => {
  const lecteur = await creerAdmin(`lecteur-zip-${Date.now()}@test.dev`, "MotDePasse123!", "LECTEUR");
  const tokenLecteur = await loginOk(lecteur.email, "MotDePasse123!");
  const tokenAdmin = await loginOk("admin@example.com", "change-moi");

  const refus = await fetch(`${baseURL}/api/ouvriers/badges/zip`, {
    headers: { Authorization: `Bearer ${tokenLecteur}` },
  });
  assert.strictEqual(refus.status, 403);
  const b = await refus.json();
  assert.strictEqual(b.code, "ACCES_REFUSE");

  const ok = await fetch(`${baseURL}/api/ouvriers/badges/zip?actif=true`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` },
  });
  // L'ADMIN a accès : soit 200 (ZIP), soit 404 AUCUN_OUVRIER si la base
  // partagée n'a pas d'ouvrier actif — en aucun cas 403.
  assert.notStrictEqual(ok.status, 403);
  if (ok.status === 404 && ok.headers.get("content-type")?.includes("json")) {
    const j = await ok.json();
    assert.strictEqual(j.code, "AUCUN_OUVRIER");
  }
});

test("POST /api/admins crée un compte avec mot de passe généré (email coupé en test)", async () => {
  const email = `cree-${Date.now()}@test.dev`;
  const res = await fetch(`${baseURL}/api/admins`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenSuper}` },
    body: JSON.stringify({ email, role: "ADMIN" }),
  });
  assert.strictEqual(res.status, 201);
  const b = await res.json();
  assert.strictEqual(b.ok, true);
  assert.strictEqual(b.admin.role, "ADMIN");
  assert.strictEqual(b.emailEnvoye, false, "SMTP coupé en test");
  assert.ok(b.motDePasseTemporaire, "le mot de passe doit être renvoyé quand l'email échoue");

  // Le compte créé se connecte avec le mot de passe généré.
  const token = await loginOk(email, b.motDePasseTemporaire);
  assert.ok(token);

  const a = await prisma.admin.findUnique({ where: { email } });
  const bon = await bcrypt.compare(b.motDePasseTemporaire, a.motDePasse);
  assert.ok(bon, "le mot de passe stocké doit correspondre au hash généré");
});

test("cycle de vie complet d'un admin géré par le SUPER_ADMIN", async () => {
  const email = `cycle-${Date.now()}@test.dev`;
  const admin = await creerAdmin(email, "MotDePasse123!", "ADMIN");
  const auth = () => ({ headers: { Authorization: `Bearer ${tokenSuper}` } });

  // Changement de rôle
  let r = await (await fetch(`${baseURL}/api/admins/${admin.id}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...auth().headers },
    body: JSON.stringify({ role: "LECTEUR" }),
  })).json();
  assert.strictEqual(r.admin.role, "LECTEUR");

  // Déblocage (compte volontairement bloqué)
  await prisma.admin.update({ where: { id: admin.id }, data: { bloqueJusqua: new Date(Date.now() + 60000), tentativesEchouees: 3 } });
  r = await (await fetch(`${baseURL}/api/admins/${admin.id}/debloquer`, {
    method: "PATCH",
    ...auth(),
  })).json();
  assert.strictEqual(r.admin.bloqueJusqua, null);
  assert.strictEqual(r.admin.tentativesEchouees, 0);

  // Désactivation → plus de connexion possible
  r = await (await fetch(`${baseURL}/api/admins/${admin.id}/desactiver`, { method: "PATCH", ...auth() })).json();
  assert.strictEqual(r.admin.actif, false);
  let lr = await login(email, "MotDePasse123!");
  assert.strictEqual(lr.status, 403);
  let lb = await lr.json();
  assert.strictEqual(lb.code, "COMPTE_DESACTIVE");

  // Réactivation
  r = await (await fetch(`${baseURL}/api/admins/${admin.id}/activer`, { method: "PATCH", ...auth() })).json();
  assert.strictEqual(r.admin.actif, true);
  lr = await login(email, "MotDePasse123!");
  assert.strictEqual(lr.status, 200);

  // Réinitialisation du mot de passe (génère + renvoie car SMTP coupé)
  r = await (await fetch(`${baseURL}/api/admins/${admin.id}/reinitialiser-mot-de-passe`, { method: "POST", ...auth() })).json();
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.emailEnvoye, false);
  assert.ok(r.motDePasseTemporaire);
  await loginOk(email, r.motDePasseTemporaire);

  // Suppression
  r = await (await fetch(`${baseURL}/api/admins/${admin.id}`, { method: "DELETE", ...auth() })).json();
  assert.strictEqual(r.ok, true);

  const reste = await prisma.admin.findUnique({ where: { id: admin.id } });
  assert.strictEqual(reste, null);
});

test("garde-fous : un SUPER_ADMIN ne peut ni se modifier ni se supprimer", async () => {
  // Changer son propre rôle
  const rRole = await fetch(`${baseURL}/api/admins/${idSuper}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenSuper}` },
    body: JSON.stringify({ role: "LECTEUR" }),
  });
  assert.strictEqual(rRole.status, 403);
  let b = await rRole.json();
  assert.strictEqual(b.code, "ACTION_IMPOSSIBLE");

  // Se désactiver soi-même
  const rDesact = await fetch(`${baseURL}/api/admins/${idSuper}/desactiver`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${tokenSuper}` },
  });
  assert.strictEqual(rDesact.status, 403);
  b = await rDesact.json();
  assert.strictEqual(b.code, "ACTION_IMPOSSIBLE");

  // Se supprimer soi-même
  const rSuppr = await fetch(`${baseURL}/api/admins/${idSuper}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenSuper}` },
  });
  assert.strictEqual(rSuppr.status, 403);
  b = await rSuppr.json();
  assert.strictEqual(b.code, "ACTION_IMPOSSIBLE");
});