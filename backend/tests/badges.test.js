import { test, before, after } from "node:test";
import assert from "node:assert";
import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma.js";

process.env.AUTH_RATE_LIMIT_MAX = "200";
process.env.SMTP_HOST = "";

let serveur;
let baseURL;
const suffixe = Date.now();
const emails = [];
const ouvriers = [];
const departements = [];

// Plus petit JPEG reconnu par sa signature (le contenu n'est pas décodé côté serveur).
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60, 1), Buffer.from([0xff, 0xd9])]);

async function session(role) {
  const email = `badges-${role.toLowerCase()}-${suffixe}-${emails.length}@test.dev`;
  await prisma.admin.create({ data: { email, motDePasse: await bcrypt.hash("MotDePasse123!", 10), role } });
  emails.push(email);
  const r = await fetch(`${baseURL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, motDePasse: "MotDePasse123!" }),
  });
  return { Authorization: `Bearer ${(await r.json()).token}` };
}

const json = (h) => ({ ...h, "Content-Type": "application/json" });

before(async () => {
  const { default: app } = await import("../src/app.js");
  serveur = app.listen(0);
  baseURL = `http://127.0.0.1:${serveur.address().port}`;
});

after(async () => {
  serveur?.close();
  if (ouvriers.length) await prisma.ouvrier.deleteMany({ where: { id: { in: ouvriers } } });
  if (departements.length) await prisma.departement.deleteMany({ where: { id: { in: departements } } });
  if (emails.length) await prisma.admin.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});

async function ouvrierDans(depNom, role = "MEMBRE", couleur = null) {
  const dep = await prisma.departement.create({ data: { nom: `${depNom} ${suffixe}-${departements.length}`, couleur } });
  departements.push(dep.id);
  const o = await prisma.ouvrier.create({
    data: {
      matricule: `TEST-BDG-${suffixe}-${ouvriers.length}`,
      nom: "CARTE",
      prenom: "Essai",
      departements: { create: { departementId: dep.id, roleDansDepartement: role } },
    },
  });
  ouvriers.push(o.id);
  return { o, dep };
}

test("carte : données prêtes à imprimer (district du temple, fonction déduite du rôle)", async () => {
  const lecteur = await session("LECTEUR");
  const { o, dep } = await ouvrierDans("HUISSIER TEST", "ADJOINT", "#BD175C");
  const r = await fetch(`${baseURL}/api/badges/carte/${o.id}`, { headers: lecteur });
  assert.strictEqual(r.status, 200);
  const { carte } = await r.json();
  assert.strictEqual(carte.ouvrier.matricule, o.matricule);
  assert.strictEqual(carte.district, "DISTRICT-SIÈGE");
  assert.strictEqual(carte.aPhoto, false);
  assert.deepStrictEqual(
    carte.departements.map((d) => [d.id, d.couleur, d.fonction, d.confectionneLe]),
    [[dep.id, "#BD175C", "RESPONSABLE ADJOINT", null]]
  );
  assert.strictEqual(carte.ouvrier.telephone, undefined);
  assert.strictEqual((await fetch(`${baseURL}/api/badges/carte/inconnu`, { headers: lecteur })).status, 404);
});

test("fonction imprimée modifiable, vide = retour au rôle", async () => {
  const admin = await session("ADMIN");
  const { o, dep } = await ouvrierDans("ACCUEIL TEST");
  const url = `${baseURL}/api/badges/fonction/${o.id}/${dep.id}`;
  const r = await fetch(url, { method: "PATCH", headers: json(admin), body: JSON.stringify({ fonctionCarte: "responsable adjointe" }) });
  assert.strictEqual((await r.json()).fonctionCarte, "RESPONSABLE ADJOINTE");
  let carte = (await (await fetch(`${baseURL}/api/badges/carte/${o.id}`, { headers: admin })).json()).carte;
  assert.strictEqual(carte.departements[0].fonction, "RESPONSABLE ADJOINTE");
  await fetch(url, { method: "PATCH", headers: json(admin), body: JSON.stringify({ fonctionCarte: "" }) });
  carte = (await (await fetch(`${baseURL}/api/badges/carte/${o.id}`, { headers: admin })).json()).carte;
  assert.strictEqual(carte.departements[0].fonction, "MEMBRE");
});

test("photo : envoi, lecture, refus d'un faux fichier, réservé aux admins", async () => {
  const admin = await session("ADMIN");
  const lecteur = await session("LECTEUR");
  const { o } = await ouvrierDans("MEDIA TEST");
  const url = `${baseURL}/api/badges/photo/${o.id}`;

  const refus = await fetch(url, { method: "POST", headers: { ...lecteur, "Content-Type": "image/jpeg" }, body: JPEG });
  assert.strictEqual(refus.status, 403);

  const faux = await fetch(url, { method: "POST", headers: { ...admin, "Content-Type": "image/jpeg" }, body: Buffer.from("<script>alert(1)</script>") });
  assert.strictEqual(faux.status, 400);
  assert.strictEqual((await faux.json()).code, "PHOTO_INVALIDE");

  const ok = await fetch(url, { method: "POST", headers: { ...admin, "Content-Type": "image/jpeg" }, body: JPEG });
  assert.strictEqual(ok.status, 200);
  const lue = await fetch(url, { headers: lecteur });
  assert.strictEqual(lue.headers.get("content-type"), "image/jpeg");
  assert.ok(Buffer.from(await lue.arrayBuffer()).equals(JPEG));
  assert.strictEqual((await (await fetch(`${baseURL}/api/badges/carte/${o.id}`, { headers: lecteur })).json()).carte.aPhoto, true);

  assert.strictEqual((await fetch(url, { method: "DELETE", headers: admin })).status, 200);
  assert.strictEqual((await fetch(url, { headers: admin })).status, 404);
});

test("confection : couleur obligatoire, puis l'ouvrier sort de « à confectionner »", async () => {
  const admin = await session("ADMIN");
  const { o, dep } = await ouvrierDans("SECURITE TEST");
  const aFaire = async () =>
    (await (await fetch(`${baseURL}/api/badges/a-confectionner?departementId=${dep.id}`, { headers: admin })).json()).ouvriers.map((x) => x.id);
  assert.deepStrictEqual(await aFaire(), [o.id]);

  const corps = JSON.stringify({ ouvrierId: o.id, departementId: dep.id });
  const sansCouleur = await fetch(`${baseURL}/api/badges/confectionnes`, { method: "POST", headers: json(admin), body: corps });
  assert.strictEqual(sansCouleur.status, 409);
  assert.strictEqual((await sansCouleur.json()).code, "COULEUR_MANQUANTE");

  const invalide = await fetch(`${baseURL}/api/departements/${dep.id}`, { method: "PATCH", headers: json(admin), body: JSON.stringify({ couleur: "rouge" }) });
  assert.strictEqual(invalide.status, 400);
  const couleur = await fetch(`${baseURL}/api/departements/${dep.id}`, { method: "PATCH", headers: json(admin), body: JSON.stringify({ couleur: "1f4fa3", libelleCarte: " chantre " }) });
  const depMaj = (await couleur.json()).departement;
  assert.strictEqual(depMaj.couleur, "#1F4FA3");
  assert.strictEqual(depMaj.libelleCarte, "CHANTRE");

  const fait = await fetch(`${baseURL}/api/badges/confectionnes`, { method: "POST", headers: json(admin), body: corps });
  assert.strictEqual(fait.status, 201);
  assert.deepStrictEqual(await aFaire(), []);
  const carte = (await (await fetch(`${baseURL}/api/badges/carte/${o.id}`, { headers: admin })).json()).carte;
  assert.ok(carte.departements[0].confectionneLe);
  assert.strictEqual(carte.departements[0].nomCarte, "CHANTRE");
  // Nom imprimé vidé : la carte reprend le nom du département.
  await fetch(`${baseURL}/api/departements/${dep.id}`, { method: "PATCH", headers: json(admin), body: JSON.stringify({ libelleCarte: "" }) });
  const carte2 = (await (await fetch(`${baseURL}/api/badges/carte/${o.id}`, { headers: admin })).json()).carte;
  assert.strictEqual(carte2.departements[0].nomCarte, carte2.departements[0].nom);

  // Modèle « titre seul » (pasteurs) : seul TITRE est accepté.
  const mauvais = await fetch(`${baseURL}/api/departements/${dep.id}`, { method: "PATCH", headers: json(admin), body: JSON.stringify({ modeleCarte: "autre" }) });
  assert.strictEqual(mauvais.status, 400);
  await fetch(`${baseURL}/api/departements/${dep.id}`, { method: "PATCH", headers: json(admin), body: JSON.stringify({ modeleCarte: "titre" }) });
  const carte3 = (await (await fetch(`${baseURL}/api/badges/carte/${o.id}`, { headers: admin })).json()).carte;
  assert.strictEqual(carte3.departements[0].modeleCarte, "TITRE");
});

test("district du temple modifiable par le SUPER_ADMIN", async () => {
  const sup = await session("SUPER_ADMIN");
  const avant = await prisma.eglise.findUnique({ where: { id: "eglise-adjahui" }, select: { libelleCarte: true } });
  try {
    const r = await fetch(`${baseURL}/api/eglises/eglise-adjahui`, { method: "PATCH", headers: json(sup), body: JSON.stringify({ libelleCarte: "district adjahui nord" }) });
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await r.json()).eglise.libelleCarte, "DISTRICT-ADJAHUI NORD");
  } finally {
    await prisma.eglise.update({ where: { id: "eglise-adjahui" }, data: { libelleCarte: avant.libelleCarte } });
  }
});

test("liste du département : responsables d'abord, état de la carte par département", async () => {
  const admin = await session("ADMIN");
  const { o: membre, dep } = await ouvrierDans("PROTOCOLE TEST", "MEMBRE", "#1F4FA3");
  const resp = await prisma.ouvrier.create({
    data: {
      matricule: `TEST-BDG-${suffixe}-${ouvriers.length}`,
      nom: "ZORO",
      prenom: "Chef",
      departements: { create: { departementId: dep.id, roleDansDepartement: "RESPONSABLE" } },
    },
  });
  ouvriers.push(resp.id);
  const inactif = await prisma.ouvrier.create({
    data: {
      matricule: `TEST-BDG-${suffixe}-${ouvriers.length}`,
      nom: "AAA",
      prenom: "Parti",
      actif: false,
      departements: { create: { departementId: dep.id } },
    },
  });
  ouvriers.push(inactif.id);

  await fetch(`${baseURL}/api/badges/confectionnes`, {
    method: "POST",
    headers: json(admin),
    body: JSON.stringify({ ouvrierId: membre.id, departementId: dep.id }),
  });
  const r = await fetch(`${baseURL}/api/badges/departement/${dep.id}`, { headers: admin });
  assert.strictEqual(r.status, 200);
  const corps = await r.json();
  assert.strictEqual(corps.departement.couleur, "#1F4FA3");
  assert.deepStrictEqual(
    corps.ouvriers.map((x) => [x.id, x.fonction, Boolean(x.confectionneLe)]),
    [
      [resp.id, "RESPONSABLE", false],
      [membre.id, "MEMBRE", true],
    ]
  );
  assert.strictEqual(corps.departement.district, "DISTRICT-SIÈGE");
  assert.strictEqual(corps.departement.nomCarte, corps.departement.nom);
  assert.ok("photoMaj" in corps.ouvriers[0]);
  assert.strictEqual((await fetch(`${baseURL}/api/badges/departement/inconnu`, { headers: admin })).status, 404);
});

test("confection en lot : couleur obligatoire, ouvriers hors département ignorés", async () => {
  const admin = await session("ADMIN");
  const lecteur = await session("LECTEUR");
  const { o: a, dep } = await ouvrierDans("LOT TEST");
  const b = await prisma.ouvrier.create({
    data: {
      matricule: `TEST-BDG-${suffixe}-${ouvriers.length}`,
      nom: "LOT",
      prenom: "Second",
      departements: { create: { departementId: dep.id } },
    },
  });
  ouvriers.push(b.id);
  const { o: dehors } = await ouvrierDans("AUTRE LOT TEST");
  const url = `${baseURL}/api/badges/confectionnes/lot`;
  const corps = JSON.stringify({ departementId: dep.id, ouvrierIds: [a.id, b.id, dehors.id] });

  assert.strictEqual((await fetch(url, { method: "POST", headers: json(lecteur), body: corps })).status, 403);
  const sansCouleur = await fetch(url, { method: "POST", headers: json(admin), body: corps });
  assert.strictEqual(sansCouleur.status, 409);
  assert.strictEqual((await fetch(url, { method: "POST", headers: json(admin), body: JSON.stringify({ departementId: dep.id, ouvrierIds: [] }) })).status, 400);

  await prisma.departement.update({ where: { id: dep.id }, data: { couleur: "#0269A3" } });
  const r = await fetch(url, { method: "POST", headers: json(admin), body: corps });
  assert.strictEqual(r.status, 201);
  assert.deepStrictEqual(await r.json(), { ok: true, crees: 2, ignores: 1 });
  const liste = await (await fetch(`${baseURL}/api/badges/departement/${dep.id}`, { headers: admin })).json();
  assert.ok(liste.ouvriers.every((x) => x.confectionneLe));
});
