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

test("CORS : même origine autorisée (terminal servi par l'API)", async () => {
  const res = await fetch(`${baseURL}/api/health`, {
    headers: { Origin: baseURL },
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get("access-control-allow-origin"), baseURL);
});

test("CORS : origine inconnue refusée => 403 ORIGINE_NON_AUTORISEE", async () => {
  const res = await fetch(`${baseURL}/api/health`, {
    headers: { Origin: "http://site-malicieux.example.com" },
  });
  assert.strictEqual(res.status, 403);
  const body = await res.json();
  assert.strictEqual(body.code, "ORIGINE_NON_AUTORISEE");
});

test("corps JSON trop gros => 413 CORPS_TROP_GROS", async () => {
  const gros = JSON.stringify({ data: "x".repeat(200 * 1024) });
  const res = await fetch(`${baseURL}/api/badgeage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: gros,
  });
  assert.strictEqual(res.status, 413);
  const body = await res.json();
  assert.strictEqual(body.code, "CORPS_TROP_GROS");
});

test("rate limit : login -> 429 TROP_DE_TENTATIVES après 5 essais", async () => {
  const tenter = () =>
    fetch(`${baseURL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@test.dev", motDePasse: "mauvais-mot-de-passe" }),
    });
  for (let i = 0; i < 5; i++) {
    const r = await tenter();
    assert.strictEqual(r.status, 401); // échec normal tant que le quota n'est pas dépassé
  }
  const res = await tenter();
  assert.strictEqual(res.status, 429);
  const body = await res.json();
  assert.strictEqual(body.code, "TROP_DE_TENTATIVES");
});