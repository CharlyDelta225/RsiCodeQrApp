import { test, before, after } from "node:test";
import assert from "node:assert";
import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma.js";
import { cleEglise } from "../src/lib/eglises.js";

process.env.AUTH_RATE_LIMIT_MAX = "200";
process.env.SMTP_HOST = "";

const SHALOM = "eglise-shalom";
const ADJAHUI = "eglise-adjahui";

let app;
let serveur;
let baseURL;
const emailsCrees = [];
const ouvriersCrees = [];
const departementsCrees = [];
const suffixe = Date.now();

async function creerAdmin(role) {
  const email = `temples-${role.toLowerCase()}-${suffixe}-${emailsCrees.length}@test.dev`;
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
  return { Authorization: `Bearer ${b.token}`, "Content-Type": "application/json" };
}

const appel = (chemin, headers, methode = "GET", corps) =>
  fetch(`${baseURL}${chemin}`, {
    method: methode,
    headers,
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });

async function ouvrier(donnees) {
  const o = await prisma.ouvrier.create({
    data: { matricule: `TEST-TPL-${suffixe}-${ouvriersCrees.length}`, nom: "TEMPLE", prenom: "Test", ...donnees },
  });
  ouvriersCrees.push(o.id);
  return o;
}

async function departement(nom, egliseId) {
  const d = await prisma.departement.create({ data: { nom: `${nom} ${suffixe}`, egliseId } });
  departementsCrees.push(d.id);
  return d;
}

before(async () => {
  ({ default: app } = await import("../src/app.js"));
  serveur = app.listen(0);
  baseURL = `http://127.0.0.1:${serveur.address().port}`;
});

after(async () => {
  serveur?.close();
  if (ouvriersCrees.length) await prisma.ouvrier.deleteMany({ where: { id: { in: ouvriersCrees } } });
  if (departementsCrees.length) await prisma.departement.deleteMany({ where: { id: { in: departementsCrees } } });
  if (emailsCrees.length) await prisma.admin.deleteMany({ where: { email: { in: emailsCrees } } });
  await prisma.$disconnect();
});

test("cleEglise : écritures équivalentes d'un même temple", () => {
  assert.strictEqual(cleEglise("Temple de 4 CROIX"), "4CROIX");
  assert.strictEqual(cleEglise("QUATRE_CROIX"), "4CROIX");
  assert.strictEqual(cleEglise("quatre-croix"), "4CROIX");
  assert.strictEqual(cleEglise("Temple ADJAHUI"), cleEglise("adjahui"));
});

test("les 3 temples existent, SHALOM est le siège ; liste publique sans compteurs", async () => {
  const pub = await (await fetch(`${baseURL}/api/eglises/public`)).json();
  assert.deepStrictEqual(pub.eglises.map((e) => e.code), ["SHALOM", "ADJAHUI", "QUATRE_CROIX"]);
  assert.strictEqual(pub.eglises[0].estSiege, true);
  assert.strictEqual(pub.eglises[0].ouvriers, undefined);

  const lecteur = await creerAdmin("LECTEUR");
  const liste = await (await appel("/api/eglises", lecteur)).json();
  const shalom = liste.eglises.find((e) => e.code === "SHALOM");
  assert.strictEqual(shalom.ouvriers, await prisma.ouvrier.count({ where: { egliseId: SHALOM } }));
  // Écriture réservée au SUPER_ADMIN.
  assert.strictEqual((await appel(`/api/eglises/${ADJAHUI}`, lecteur, "PATCH", { nom: "X" })).status, 403);
});

test("valeur par défaut : un ouvrier créé sans temple appartient au siège", async () => {
  const admin = await creerAdmin("ADMIN");
  const r = await appel("/api/ouvriers", admin, "POST", { nom: "DEFAUT", prenom: `Siege${suffixe}` });
  assert.strictEqual(r.status, 201);
  const b = await r.json();
  ouvriersCrees.push(b.ouvrier.id);
  assert.strictEqual(b.ouvrier.egliseId, SHALOM);
  assert.strictEqual(b.ouvrier.eglise.code, "SHALOM");

  const inconnu = await appel("/api/ouvriers", admin, "POST", { nom: "X", prenom: "Y", egliseId: "NULLE-PART" });
  assert.strictEqual(inconnu.status, 400);
  assert.strictEqual((await inconnu.json()).code, "EGLISE_INCONNUE");
});

test("départements : même nom autorisé dans deux temples, pas deux fois dans le même", async () => {
  const admin = await creerAdmin("ADMIN");
  const nom = `CHORALE TPL ${suffixe}`;
  const a = await appel("/api/departements", admin, "POST", { nom, egliseId: "SHALOM" });
  const b = await appel("/api/departements", admin, "POST", { nom, egliseId: "ADJAHUI" });
  assert.strictEqual(a.status, 201);
  assert.strictEqual(b.status, 201);
  departementsCrees.push((await a.json()).departement.id, (await b.json()).departement.id);
  const doublon = await appel("/api/departements", admin, "POST", { nom: nom.toLowerCase(), egliseId: "ADJAHUI" });
  assert.strictEqual(doublon.status, 409);

  const filtre = await (await appel(`/api/departements?egliseId=${ADJAHUI}&limit=100`, admin)).json();
  assert.ok(filtre.departements.every((d) => d.egliseId === ADJAHUI));
  assert.ok(filtre.departements.some((d) => d.nom === nom));
});

test("un ouvrier ne rejoint pas un département d'un autre temple ; le transfert retire les anciens", async () => {
  const admin = await creerAdmin("ADMIN");
  const o = await ouvrier({ egliseId: SHALOM });
  const depShalom = await departement("ACCUEIL TPL", SHALOM);
  const depAdjahui = await departement("ACCUEIL TPL", ADJAHUI);

  const refus = await appel(`/api/departements/${depAdjahui.id}/membres`, admin, "POST", { ouvrierId: o.id });
  assert.strictEqual(refus.status, 409);
  assert.strictEqual((await refus.json()).code, "EGLISE_DIFFERENTE");

  assert.strictEqual((await appel(`/api/departements/${depShalom.id}/membres`, admin, "POST", { ouvrierId: o.id })).status, 201);

  const t = await appel(`/api/ouvriers/${o.id}/transferer`, admin, "PATCH", { egliseId: "adjahui" });
  assert.strictEqual(t.status, 200);
  const tb = await t.json();
  assert.strictEqual(tb.ouvrier.egliseId, ADJAHUI);
  assert.deepStrictEqual(tb.departementsRetires, [depShalom.nom]);
  assert.strictEqual(tb.ouvrier.departements.length, 0);

  assert.strictEqual((await appel(`/api/departements/${depAdjahui.id}/membres`, admin, "POST", { ouvrierId: o.id })).status, 201);
});

test("badgeage : lieu = temple du terminal, visiteur signalé, temple inconnu refusé", async () => {
  const visiteur = await ouvrier({ egliseId: SHALOM });
  const dep = await departement("PROTOCOLE TPL", SHALOM);
  await prisma.ouvrierDepartement.create({ data: { ouvrierId: visiteur.id, departementId: dep.id } });

  const inconnu = await appel("/api/badgeage", { "Content-Type": "application/json" }, "POST", {
    matricule: visiteur.matricule,
    temple: "NULLE-PART",
  });
  assert.strictEqual(inconnu.status, 400);
  assert.strictEqual((await inconnu.json()).code, "TEMPLE_INCONNU");

  const r = await appel("/api/badgeage", { "Content-Type": "application/json" }, "POST", {
    matricule: visiteur.matricule,
    temple: "ADJAHUI",
  });
  assert.strictEqual(r.status, 200);
  const b = await r.json();
  assert.strictEqual(b.visiteur, true);
  assert.strictEqual(b.lieu.code, "ADJAHUI");
  assert.strictEqual(b.ouvrier.eglise.code, "SHALOM");
  assert.deepStrictEqual(b.ouvrier.departements, [dep.nom]);
  const enBase = await prisma.pointage.findFirst({ where: { ouvrierId: visiteur.id } });
  assert.strictEqual(enBase.egliseId, ADJAHUI);

  // Ancien terminal (sans « temple ») : badgeage au siège.
  const local = await ouvrier({ egliseId: SHALOM });
  const r2 = await appel("/api/badgeage", { "Content-Type": "application/json" }, "POST", { matricule: local.matricule });
  const b2 = await r2.json();
  assert.strictEqual(b2.lieu.code, "SHALOM");
  assert.strictEqual(b2.visiteur, false);

  // Rapport : le visiteur est compté dans SON temple, avec le lieu indiqué.
  const lecteur = await creerAdmin("LECTEUR");
  const rapport = (await (await appel(`/api/rapports/journalier?egliseId=${SHALOM}`, lecteur)).json()).rapport;
  assert.ok(rapport.departements.every((d) => d.eglise.id === SHALOM));
  const ligne = rapport.departements.find((d) => d.id === dep.id).lignes[0];
  assert.strictEqual(ligne.visiteur, true);
  assert.strictEqual(ligne.lieu.code, "ADJAHUI");
  assert.deepStrictEqual(rapport.recapParEglise.map((e) => e.code), ["SHALOM"]);
  assert.strictEqual(rapport.recapParEglise[0].effectif, rapport.recap.effectif);

  // Stats et historique filtrés par temple.
  const stats = await (await appel(`/api/pointages/stats?egliseId=${SHALOM}`, lecteur)).json();
  assert.strictEqual(stats.ouvriers.total, await prisma.ouvrier.count({ where: { egliseId: SHALOM } }));
  assert.ok(stats.visiteursAuj >= 1);
  assert.strictEqual(stats.parEglise.length, 3);
  const aujISO = new Date().toISOString().slice(0, 10);
  const lieux = await (await appel(`/api/pointages?du=${aujISO}&au=${aujISO}&lieuId=${ADJAHUI}`, lecteur)).json();
  assert.ok(lieux.pointages.some((p) => p.ouvrier.id === visiteur.id && p.visiteur && p.eglise.code === "ADJAHUI"));
});

test("import : colonne Temple, département cherché dans ce temple", async () => {
  const admin = await creerAdmin("ADMIN");
  const dep = await departement("MEDIAS TPL", ADJAHUI);
  const csv = `Nom;Prénom;Département;Téléphone;Temple\nIMPORT;Tpl${suffixe};${dep.nom};0700000000;Temple ADJAHUI\n`;
  const form = new FormData();
  form.append("fichier", new Blob([csv], { type: "text/csv" }), "import.csv");
  const r = await fetch(`${baseURL}/api/ouvriers/import`, {
    method: "POST",
    headers: { Authorization: admin.Authorization },
    body: form,
  });
  const b = await r.json();
  assert.strictEqual(r.status, 200, JSON.stringify(b));
  assert.strictEqual(b.creees, 1);
  const cree = await prisma.ouvrier.findFirst({ where: { prenom: `Tpl${suffixe}` }, include: { departements: true } });
  ouvriersCrees.push(cree.id);
  assert.strictEqual(cree.egliseId, ADJAHUI);
  assert.strictEqual(cree.departements[0].departementId, dep.id);

  // Même département demandé au siège : il n'y existe pas → import refusé.
  const csv2 = `Nom;Prénom;Département;Téléphone;Temple\nIMPORT;Bis${suffixe};${dep.nom};0700000001;SHALOM\n`;
  const form2 = new FormData();
  form2.append("fichier", new Blob([csv2], { type: "text/csv" }), "import.csv");
  const r2 = await fetch(`${baseURL}/api/ouvriers/import`, {
    method: "POST",
    headers: { Authorization: admin.Authorization },
    body: form2,
  });
  assert.strictEqual(r2.status, 400);
  assert.strictEqual((await r2.json()).code, "DEPARTEMENT_INCONNU");
});
