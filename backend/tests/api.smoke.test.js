import { test, before, after } from "node:test";
import assert from "node:assert";
import app from "../src/app.js";

let serveur;
let baseURL;

before(async () => {
  serveur = app.listen(0); // port 0 = port éphémère (pas de conflit)
  const port = serveur.address().port;
  baseURL = `http://127.0.0.1:${port}`;
});

after(() => {
  serveur.close();
});

test("GET /api/health répond ok", async () => {
  const res = await fetch(`${baseURL}/api/health`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.status, "ok");
});

test("POST /api/badgeage sans matricule => 400 MATRICULE_MANQUANT", async () => {
  const res = await fetch(`${baseURL}/api/badgeage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.strictEqual(body.code, "MATRICULE_MANQUANT");
});

test("POST /api/badgeage avec matricule inconnu => 404 BADGE_INCONNU", async () => {
  const res = await fetch(`${baseURL}/api/badgeage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ matricule: "RSI-9999" }),
  });
  assert.strictEqual(res.status, 404);
  const body = await res.json();
  assert.strictEqual(body.code, "BADGE_INCONNU");
});

test("GET /api/ouvriers sans token => 401 AUTH_REQUISE", async () => {
  const res = await fetch(`${baseURL}/api/ouvriers`);
  assert.strictEqual(res.status, 401);
  const body = await res.json();
  assert.strictEqual(body.code, "AUTH_REQUISE");
});

test("route inconnue => 404 ROUTE_INCONNUE", async () => {
  const res = await fetch(`${baseURL}/api/inexistant`);
  assert.strictEqual(res.status, 404);
  const body = await res.json();
  assert.strictEqual(body.code, "ROUTE_INCONNUE");
});