import { test, before, after } from "node:test";
import assert from "node:assert";
import app from "../src/app.js";
import { estJourDeProgramme, JOURS_PROGRAMME, seuilPourJour } from "../src/lib/rapport.js";

let serveur;
let baseURL;

before(async () => {
  serveur = app.listen(0);
  const port = serveur.address().port;
  baseURL = `http://127.0.0.1:${port}`;
});

after(() => {
  serveur.close();
});

// ---------- Logique des jours de programme ----------

const mercredi = new Date("2026-09-09T10:00:00"); // un mercredi
const vendredi = new Date("2026-09-11T10:00:00"); // un vendredi
const dimanche = new Date("2026-09-13T10:00:00"); // un dimanche

test("JOURS_PROGRAMME contient Mercredi (3), Vendredi (5), Dimanche (0)", () => {
  assert.deepStrictEqual(Object.keys(JOURS_PROGRAMME).sort(), ["0", "3", "5"]);
});

test("estJourDeProgramme : mercredi/vendredi/dimanche = vrai", () => {
  assert.strictEqual(estJourDeProgramme(mercredi), true);
  assert.strictEqual(estJourDeProgramme(vendredi), true);
  assert.strictEqual(estJourDeProgramme(dimanche), true);
});

test("estJourDeProgramme : lundi/mardi/jeudi/samedi = faux", () => {
  const lundi = new Date("2026-09-14T10:00:00");
  const mardi = new Date("2026-09-15T10:00:00");
  const jeudi = new Date("2026-09-10T10:00:00");
  const samedi = new Date("2026-09-12T10:00:00");
  assert.strictEqual(estJourDeProgramme(lundi), false);
  assert.strictEqual(estJourDeProgramme(mardi), false);
  assert.strictEqual(estJourDeProgramme(jeudi), false);
  assert.strictEqual(estJourDeProgramme(samedi), false);
});

test("seuils : mercredi/vendredi 21:30, dimanche 12:00", () => {
  assert.strictEqual(JOURS_PROGRAMME[3].seuil.heures, 21);
  assert.strictEqual(JOURS_PROGRAMME[3].seuil.minutes, 30);
  assert.strictEqual(JOURS_PROGRAMME[5].seuil.heures, 21);
  assert.strictEqual(JOURS_PROGRAMME[5].seuil.minutes, 30);
  assert.strictEqual(JOURS_PROGRAMME[0].seuil.heures, 12);
  assert.strictEqual(JOURS_PROGRAMME[0].seuil.minutes, 0);
});

test("seuilPourJour : seuil en minutes jours programme, null hors programme", () => {
  assert.strictEqual(seuilPourJour(mercredi), 21 * 60 + 30);
  assert.strictEqual(seuilPourJour(vendredi), 21 * 60 + 30);
  assert.strictEqual(seuilPourJour(dimanche), 12 * 60);
  assert.strictEqual(seuilPourJour(new Date("2026-09-14T10:00:00")), null); // lundi
});

// ---------- Route API rapports ----------

async function obtenirToken() {
  const res = await fetch(`${baseURL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@example.com", motDePasse: "change-moi" }),
  });
  assert.strictEqual(res.status, 200, "login admin attendu pour la suite");
  const body = await res.json();
  return body.token;
}

test("GET /api/rapports/journalier sans token => 401 AUTH_REQUISE", async () => {
  const res = await fetch(`${baseURL}/api/rapports/journalier`);
  assert.strictEqual(res.status, 401);
  const body = await res.json();
  assert.strictEqual(body.code, "AUTH_REQUISE");
});

test("GET /api/rapports/journalier date invalide => 400 DATE_INVALIDE", async () => {
  const token = await obtenirToken();
  const res = await fetch(`${baseURL}/api/rapports/journalier?date=pas-une-date`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.strictEqual(body.code, "DATE_INVALIDE");
});

test("GET /api/rapports/journalier : structure attendue (lieux + totaux cohérents)", async () => {
  const token = await obtenirToken();
  const res = await fetch(`${baseURL}/api/rapports/journalier`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.ok, true);

  const rapport = body.rapport;
  assert.ok(rapport.dateISO, "dateISO présent");
  assert.ok(Array.isArray(rapport.departements));
  assert.ok(typeof rapport.recap === "object");

  const totaux = rapport.departements.reduce(
    (acc, d) => ({
      presents: acc.presents + d.presents,
      absents: acc.absents + d.absents,
      effectif: acc.effectif + d.effectif,
    }),
    { presents: 0, absents: 0, effectif: 0 }
  );
  assert.strictEqual(rapport.recap.presents, totaux.presents);
  assert.strictEqual(rapport.recap.absents, totaux.absents);
  assert.strictEqual(rapport.recap.effectif, totaux.effectif);

  const lignes = rapport.departements.flatMap((d) => d.lignes);
  assert.ok(Array.isArray(lignes));
  lignes.forEach((l) => {
    assert.ok("present" in l);
    assert.ok(typeof l.present === "boolean");
    assert.ok(l.heure === null || typeof l.heure === "string");
  });
});

test("GET /api/rapports/journalier ?departementId : filtre + recap recalculé", async () => {
  const token = await obtenirToken();

  const toutRes = await fetch(`${baseURL}/api/rapports/journalier`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const tout = await toutRes.json();
  const dep = tout.rapport.departements[0];
  if (!dep) return; // aucune donnée : rien à vérifier

  const res = await fetch(
    `${baseURL}/api/rapports/journalier?departementId=${encodeURIComponent(dep.id)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.rapport.departements.length, 1);
  assert.strictEqual(body.rapport.departements[0].id, dep.id);
  assert.strictEqual(body.rapport.recap.presents, dep.presents);
  assert.strictEqual(body.rapport.recap.absents, dep.absents);
  assert.strictEqual(body.rapport.recap.effectif, dep.effectif);
});

test("GET /api/rapports/journalier ?departementId inconnu => 404 DEPARTEMENT_INCONNU", async () => {
  const token = await obtenirToken();
  const res = await fetch(
    `${baseURL}/api/rapports/journalier?departementId=inexistant-id`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  assert.strictEqual(res.status, 404);
  const body = await res.json();
  assert.strictEqual(body.code, "DEPARTEMENT_INCONNU");
});

test("POST /api/rapports/journalier sans token => 401 AUTH_REQUISE", async () => {
  const res = await fetch(`${baseURL}/api/rapports/journalier`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.strictEqual(res.status, 401);
  const body = await res.json();
  assert.strictEqual(body.code, "AUTH_REQUISE");
});