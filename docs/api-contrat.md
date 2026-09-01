# Contrat d'API — RsiCodeQrApp (backend)

Document de référence pour l'équipe frontend (terminal kiosque + dashboard).
Toute modification d'endpoint ou de format de réponse est annoncée ici, en
versionnant la date de changement.

- Base URL (dev local) : `http://localhost:3000`
- Base URL (production) : fournie après déploiement Railway
- Format des corps : JSON (`Content-Type: application/json`)
- CORS : activé (autorise le terminal et le dashboard)

---

## Format commun des réponses

**Succès** : `{ "ok": true, ... }`
**Erreur** : `{ "ok": false, "code": "CODE_MACHINE", "message": "Message lisible" }`

> Les codes machines (`code`) sont stables : c'est sur eux que le front fait
> ses branchements (ex : fond rouge si `BADGE_INCONNU`), pas sur les messages.

---

## 1. Badgeage (PUBLIC — utilisé par le terminal)

### `POST /api/badgeage`

Appelé à chaque scan du QR par le terminal.

**Body envoyé** :
```json
{ "matricule": "RSI-0001" }
```

**Réponse 200 — badge valide (pointage enregistré)** :
```json
{
  "ok": true,
  "ouvrier": {
    "id": "f723f9ad-626e-49ac-8db8-a95977ec45e6",
    "matricule": "RSI-0001",
    "nom": "KOUAME",
    "prenom": "Aya",
    "departement": "Louange"
  }
}
```

**Réponses d'erreur** :
| HTTP | code | message |
|---|---|---|
| 400 | `MATRICULE_MANQUANT` | Le champ matricule est requis |
| 404 | `BADGE_INCONNU` | Badge inconnu |
| 403 | `BADGE_DESACTIVE` | Badge désactivé |
| 500 | `ERREUR_INTERNE` | Erreur interne |

> Le terminal affiche nom/prénom/département sur fond vert ; sur `BADGE_INCONNU`
> ou `BADGE_DESACTIVE`, il affiche le `message` sur fond rouge.

---

## 2. Authentification (PUBLIC)

### `POST /api/auth/login`
```json
// Body
{ "email": "admin@example.com", "motDePasse": "change-moi" }

// Réponse 200
{ "ok": true, "token": "<JWT>", "admin": { "id": "...", "email": "..." } }

// Erreurs
// 401 { "ok": false, "code": "IDENTIFIANTS_INVALIDES", ... }
// 400 { "ok": false, "code": "CHAMPS_MANQUANTS", ... }
```

### `GET /api/auth/me` (protégé)
Renvoie l'admin connecté : `{ "ok": true, "admin": { "id", "email", "createdAt" } }`

### `POST /api/auth/register` (phase de mise en place uniquement)
Crée un premier admin. Body `{ "email", "motDePasse" }`, mot de passe ≥ 8 caractères.

---

## 3. Ouvriers (PROTÉGÉ — header `Authorization: Bearer <token>`)

### `GET /api/ouvriers`
Query optionnels :
- `actif=true|false` — filtre par état
- `recherche=texte` — nom, prénom, département, matricule (insensible à la casse)
- `page=1&limit=50` — pagination (défauts : `page=1`, `limit=50`, max `limit=200`)

```json
{ "ok": true, "total": 11, "page": 1, "limit": 50, "ouvriers": [ ... ] }
```

### `POST /api/ouvriers`
```json
// Body (matricule optionnel — généré automatiquement)
{ "nom": "YAO", "prenom": "Esther", "departement": "Média", "photoUrl": null, "actif": true }
// Réponse 201 : { "ok": true, "ouvrier": { ... } }
```

### `GET /api/ouvriers/:id`
Détail complet d'un ouvrier.

### `PATCH /api/ouvriers/:id`
Met à jour tout ou partie. **Désactivation d'un badge** : `{ "actif": false }`.

### `DELETE /api/ouvriers/:id`
Supprime l'ouvrier et ses pointages (cascade).

### `GET /api/ouvriers/:id/badge`
Renvoie le **PNG du QR code** du badge (type `image/png`) — pour prévisualiser/imprimer.

---

## 4. Pointages (PROTÉGÉ — header `Authorization: Bearer <token>`)

### `GET /api/pointages`
Query optionnels :
- `du=YYYY-MM-DD` / `au=YYYY-MM-DD` — plage de dates (bornes incluses sur `au`)
- `ouvrierId=uuid` — filtre par ouvrier
- `page=1&limit=50` — pagination

```json
{
  "ok": true, "total": 42, "page": 1, "limit": 50,
  "pointages": [
    {
      "id": "...",
      "dateHeure": "2026-09-01T10:54:12.246Z",
      "type": "ENTRER",
      "ouvrier": { "id": "...", "matricule": "RSI-0001", "nom": "KOUAME", "prenom": "Aya", "departement": "Louange" }
    }
  ]
}
```

> `type` est présent mais **non utilisé** pour l'instant (toujours `ENTRER`).

---

## 5. Divers

- `GET /api/health` — public, `{ "status": "ok", ... }`. Utilisé par les healthcheck Railway/Render.
- Toute route inconnue → `404 { "ok": false, "code": "ROUTE_INCONNUE", ... }`

---

## Journal des changements de contrat

| Date | Changement |
|---|---|
| 2026-09-01 | Création du document (v1) — badgeage, auth, ouvriers, pointages |