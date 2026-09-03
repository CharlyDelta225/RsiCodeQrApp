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

## 2. Authentification

### Rôles admin (`RoleAdmin`)
Hiérarchie : `SUPER_ADMIN` > `ADMIN` > `LECTEUR`
| Rôle | Ouvriers (lecture) | Ouvriers (écriture/import) | Pointages | Gérer les rôles (`/api/admins`) |
|---|---|---|---|---|
| `LECTEUR` | ✅ | ❌ | ✅ | ❌ |
| `ADMIN` | ✅ | ✅ | ✅ | ❌ |
| `SUPER_ADMIN` | ✅ | ✅ | ✅ | ✅ |

### `POST /api/auth/login` (PUBLIC)
```json
// Body
{ "email": "admin@example.com", "motDePasse": "change-moi" }

// Réponse 200
{ "ok": true, "token": "<JWT>", "admin": { "id": "...", "email": "...", "role": "SUPER_ADMIN" } }

// Erreurs
// 401 { "ok": false, "code": "IDENTIFIANTS_INVALIDES", ... }
// 400 { "ok": false, "code": "CHAMPS_MANQUANTS", ... }
```

### `GET /api/auth/me` (protégé)
Renvoie l'admin connecté : `{ "ok": true, "admin": { "id", "email", "role", "createdAt" } }`

### `POST /api/auth/register` (PUBLIC)
Création d'un compte. Tout nouveau compte naît **`LECTEUR`** (aucun pouvoir d'écriture). L'élévation vers `ADMIN`/`SUPER_ADMIN` se fait ensuite par un `SUPER_ADMIN` via `PATCH /api/admins/:id/role`.
```json
// Body
{ "email": "lambda@eglise.com", "motDePasse": "lambda123" }
// (rôle NON accepté ici : tout inscrit est LECTEUR, le rôle fourni est ignoré)

// Réponse 201
{ "ok": true, "admin": { "id": "...", "email": "...", "role": "LECTEUR", "createdAt": "..." } }

// Erreurs
// 400 motDePasse < 8 → MOT_DE_PASSE_TROP_COURT
// 409 email déjà pris → EMAIL_EXISTANT
```

### `GET /api/admins` (protégé — **SUPER_ADMIN uniquement**)
Liste tous les comptes admin (pour la gestion des rôles côté dashboard).
```json
{ "ok": true, "admins": [ { "id": "...", "email": "...", "role": "LECTEUR", "createdAt": "..." } ] }
```

### `PATCH /api/admins/:id/role` (protégé — **SUPER_ADMIN uniquement**)
Change le rôle d'un compte admin.
```json
// Body
{ "role": "ADMIN" }   // valeurs : ADMIN | LECTEUR | SUPER_ADMIN

// Réponse 200
{ "ok": true, "admin": { "id": "...", "email": "...", "role": "ADMIN", "createdAt": "..." } }

// Erreurs
// 400 rôle invalide       → ROLE_INVALIDE
// 404 compte introuvable  → ADMIN_INCONNU
// 403 auto-rétrogradation → ACTION_IMPOSSIBLE (on ne peut pas modifier son propre rôle)
```
> Garde-fou : un `SUPER_ADMIN` ne peut **pas** se modifier lui-même (anti-verrouillage).

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

### `PATCH /api/ouvriers/:id/activer` (protégé — ADMIN/SUPER_ADMIN)
Active le badge d'un ouvrier. Réponse : `{ "ok": true, "actif": true, "ouvrier": {...} }`.

### `PATCH /api/ouvriers/:id/desactiver` (protégé — ADMIN/SUPER_ADMIN)
Désactive le badge : le badgeage de ce matricule répondra `403 BADGE_DESACTIVE`. Réponse : `{ "ok": true, "actif": false, "ouvrier": {...} }`.

### `DELETE /api/ouvriers/:id`
Supprime l'ouvrier et ses pointages (cascade).

### `GET /api/ouvriers/:id/badge`
Renvoie le **PNG du QR code** du badge (type `image/png`) — pour prévisualiser/imprimer.

### `POST /api/ouvriers/import` (protégé)
Import **massif** d'ouvriers depuis un fichier `.csv` ou `.xlsx` (multipart/form-data, champ `fichier`). Crée automatiquement un matricule et un QR badge par ouvrier.

Colonnes **obligatoires** dans le fichier (1re ligne = en-tête) :
```
Nom,Prénom,Département
KEITA,Awa,Chorale
```

Règles :
- Extension autres que `.csv`/`.xlsx` → `400 TYPE_FICHIER_NON_SUPPORTE`
- Colonnes manquantes → `400 COLONNES_MANQUANTES`
- Fichier vide / illisible → `400 FICHIER_VIDE` ou `FORMAT_INVALIDE`
- Doublon (même Nom+Prénom+Département) → ligne **ignorée**
- Champ requis vide → ligne marquée en **erreur**

```json
{
  "ok": true, "creees": 2, "ignorees": 1, "erreurs": 1,
  "detail": [
    { "nom": "KEITA", "prenom": "Awa", "departement": "Chorale", "matricule": "RSI-671C", "statut": "cree" },
    { "nom": "KOUAME", "prenom": "Jean", "departement": "Louange", "statut": "ignore", "raison": "doublon" },
    { "nom": "", "prenom": "X", "departement": "Y", "statut": "erreur", "raison": "nom manquant" }
  ]
}
```

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

## 6. Divers

- `GET /api/health` — public, `{ "status": "ok", ... }`. Utilisé par les healthcheck Railway/Render.
- Toute route inconnue → `404 { "ok": false, "code": "ROUTE_INCONNUE", ... }`

---

## Journal des changements de contrat

| Date | Changement |
|---|---|
| 2026-09-03 | Ajout de `POST /api/ouvriers/import` (import massif .csv/.xlsx + QR auto) |
| 2026-09-03 | Ajout des rôles (`RoleAdmin`) : login/me renvoient `role`, register réservé au SUPER_ADMIN, écritures ouvriers/import réservées à ADMIN/SUPER_ADMIN |
| 2026-09-03 | Register rendu **public** (tout inscrit = `LECTEUR`) + ajout de `GET /api/admins` et `PATCH /api/admins/:id/role` (gestion des rôles par SUPER_ADMIN, auto-rétrogradation bloquée) |
| 2026-09-03 | Ajout de `PATCH /api/ouvriers/:id/activer` et `PATCH /api/ouvriers/:id/desactiver` (endpoints dédiés actif/inactif) |
| 2026-09-01 | Création du document (v1) — badgeage, auth, ouvriers, pointages |