import { test, before, after } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma.js";

// Les routes sensibles ont un rate-limit IP (5/min par défaut). On le relâche
// pour que les tentatives successives de ce fichier ne déclenchent pas de 429.
// Le SMTP est coupé : aucun email réel ne part pendant la suite.
process.env.AUTH_RATE_LIMIT_MAX = "200";
process.env.SMTP_HOST = "";

let app;
let serveur;
let baseURL;
const emailsCrees = [];

function sha256(texte) {
  return crypto.createHash("sha256").update(texte).digest("hex");
}

async function creerAdmin(email, motDePasse = "BonMotDePasse1!", role = "ADMIN") {
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

before(async () => {
  ({ default: app } = await import("../src/app.js"));
  serveur = app.listen(0);
  const port = serveur.address().port;
  baseURL = `http://127.0.0.1:${port}`;
});

after(async () => {
  serveur?.close();
  if (emailsCrees.length > 0) {
    await prisma.admin.deleteMany({ where: { email: { in: emailsCrees } } });
  }
  await prisma.$disconnect();
});

test("3 mauvais mots de passe → reste 2 puis 1, puis compte gelé (423 COMPTE_BLOQUE)", async () => {
  const email = `tentative-${Date.now()}@test.dev`;
  await creerAdmin(email, "BonMotDePasse1!");

  // 1er échec : il reste 2 tentatives
  let r = await login(email, "mauvais-1");
  assert.strictEqual(r.status, 401);
  let b = await r.json();
  assert.strictEqual(b.code, "IDENTIFIANTS_INVALIDES");
  assert.strictEqual(b.reste, 2);

  // 2e échec : il reste 1 tentative
  r = await login(email, "mauvais-2");
  b = await r.json();
  assert.strictEqual(r.status, 401);
  assert.strictEqual(b.reste, 1);

  // 3e échec : gel du compte 15 minutes
  r = await login(email, "mauvais-3");
  assert.strictEqual(r.status, 423);
  b = await r.json();
  assert.strictEqual(b.code, "COMPTE_BLOQUE");
  assert.ok(b.reste > 0, "reste des minutes de blocage attendu");

  // Même avec le BON mot de passe, le compte reste gelé pendant le blocage.
  r = await login(email, "BonMotDePasse1!");
  assert.strictEqual(r.status, 423);
  b = await r.json();
  assert.strictEqual(b.code, "COMPTE_BLOQUE");
});

test("déblocage manuel → le bon mot de passe reconnecte et remet le compteur à zéro", async () => {
  const email = `deblocage-${Date.now()}@test.dev`;
  await creerAdmin(email, "BonMotDePasse1!");

  // On simule un compte gelé.
  await prisma.admin.update({
    where: { email },
    data: { bloqueJusqua: new Date(Date.now() + 15 * 60 * 1000), tentativesEchouees: 3 },
  });

  // Le SUPER_ADMIN débloque (comme routes/admins.routes.js).
  await prisma.admin.update({
    where: { email },
    data: { bloqueJusqua: null, tentativesEchouees: 0 },
  });

  const r = await login(email, "BonMotDePasse1!");
  assert.strictEqual(r.status, 200);
  const b = await r.json();
  assert.strictEqual(b.ok, true);
  assert.ok(b.token, "token JWT attendu");
  assert.strictEqual(b.admin.email, email);

  const a = await prisma.admin.findUnique({ where: { email } });
  assert.strictEqual(a.tentativesEchouees, 0);
  assert.strictEqual(a.bloqueJusqua, null);
});

test("le bon mot de passe remet les tentatives à zéro avant blocage", async () => {
  const email = `assainissement-${Date.now()}@test.dev`;
  await creerAdmin(email, "BonMotDePasse1!");

  await login(email, "mauvais-1");
  await login(email, "mauvais-2");

  const r = await login(email, "BonMotDePasse1!");
  assert.strictEqual(r.status, 200);

  const a = await prisma.admin.findUnique({ where: { email } });
  assert.strictEqual(a.tentativesEchouees, 0);
  assert.strictEqual(a.bloqueJusqua, null);
});

test("POST /api/auth/reset-demand : réponse ok même si l'email est inconnu", async () => {
  const r = await fetch(`${baseURL}/api/auth/reset-demand`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `inconnu-${Date.now()}@test.dev` }),
  });
  assert.strictEqual(r.status, 200);
  const b = await r.json();
  assert.strictEqual(b.ok, true);
});

test("reset-demand sur compte connu : token stocké HASHÉ + expiration (email coupé en test)", async () => {
  const email = `reset-demand-${Date.now()}@test.dev`;
  await creerAdmin(email, "BonMotDePasse1!");

  const r = await fetch(`${baseURL}/api/auth/reset-demand`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  assert.strictEqual(r.status, 200);
  const b = await r.json();
  assert.strictEqual(b.ok, true);
  assert.strictEqual(b.emailEnvoye, false); // SMTP coupé en test

  const a = await prisma.admin.findUnique({ where: { email } });
  assert.ok(a.resetTokenHash, "empreinte du token attendue");
  assert.notStrictEqual(a.resetTokenHash, sha256("lien"));
  assert.ok(a.resetTokenExpire > new Date(), "l'expiration doit être dans le futur");
});

test("POST /api/auth/reset avec un lien valide change le mot de passe et consomme le lien", async () => {
  const email = `reset-ok-${Date.now()}@test.dev`;
  await creerAdmin(email, "AncienMdp123!");

  const token = "jeton-de-test-unique";
  // On simule un compte gelé ET muni d'un lien : le reset doit tout lever.
  await prisma.admin.update({
    where: { email },
    data: {
      resetTokenHash: sha256(token),
      resetTokenExpire: new Date(Date.now() + 60 * 60 * 1000),
      bloqueJusqua: new Date(Date.now() + 15 * 60 * 1000),
      tentativesEchouees: 3,
    },
  });

  const r = await fetch(`${baseURL}/api/auth/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, motDePasse: "NouveauMdp456!" }),
  });
  assert.strictEqual(r.status, 200);

  const a = await prisma.admin.findUnique({ where: { email } });
  const bon = await bcrypt.compare("NouveauMdp456!", a.motDePasse);
  assert.ok(bon, "le nouveau mot de passe doit être enregistré");
  assert.strictEqual(a.resetTokenHash, null, "le lien doit être consommé");
  assert.strictEqual(a.bloqueJusqua, null, "le reset doit lever le blocage");
});

test("POST /api/auth/reset : token inconnu ou expiré → 400 LIEN_INVALIDE_OU_EXPIRE", async () => {
  const r = await fetch(`${baseURL}/api/auth/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "token-inconnu", motDePasse: "NouveauMdp456!" }),
  });
  assert.strictEqual(r.status, 400);
  let b = await r.json();
  assert.strictEqual(b.code, "LIEN_INVALIDE_OU_EXPIRE");

  const email = `reset-expire-${Date.now()}@test.dev`;
  await creerAdmin(email, "AncienMdp123!");
  await prisma.admin.update({
    where: { email },
    data: {
      resetTokenHash: sha256("token-expire"),
      resetTokenExpire: new Date(Date.now() - 1000),
    },
  });
  const r2 = await fetch(`${baseURL}/api/auth/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "token-expire", motDePasse: "NouveauMdp456!" }),
  });
  assert.strictEqual(r2.status, 400);
  b = await r2.json();
  assert.strictEqual(b.code, "LIEN_INVALIDE_OU_EXPIRE");
});