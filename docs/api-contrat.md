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
> `departement` = nom du premier département trouvé pour cet ouvrier, ou `null`
> s'il n'appartient à aucun département.

**Réponses d'erreur** :
| HTTP | code | message |
|---|---|---|
| 400 | `MATRICULE_MANQUANT` | Le champ matricule est requis |
| 404 | `BADGE_INCONNU` | Badge inconnu |
| 403 | `BADGE_DESACTIVE` | Badge désactivé |
| 409 | `DEJA_BADGE_AUJOURDHUI` | Vous avez déjà badgé aujourd'hui à HH:MM |
| 500 | `ERREUR_INTERNE` | Erreur interne |

> **Anti double-badge** : un ouvrier ne peut badger qu'**une seule fois par jour
> civil** (heure serveur). Le second scan renvoie `409 DEJA_BADGE_AUJOURDHUI` avec
> l'heure du premier badgeage — le terminal doit l'afficher (ex : fond orange).
>
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

> **Modèle des départements (depuis le 2026-09-04)** : un ouvrier n'a plus de
> champ `departement` (string). Il est rattaché à un ou plusieurs départements
> via la relation `departements` (table de jonction `OuvrierDepartement` avec un
> poste par département). Voir la section 4‑bis « Départements ».
>
> Dans les réponses `ouvrier`, la relation apparaît sous la forme :
> ```json
> "departements": [ { "id": "...", "departementId": "...", "roleDansDepartement": "MEMBRE",
>                     "departement": { "id": "...", "nom": "Louange" } } ]
> ```

### `GET /api/ouvriers`
Query optionnels :
- `actif=true|false` — filtre par état
- `recherche=texte` — nom, prénom, matricule (insensible à la casse)
- `page=1&limit=50` — pagination (défauts : `page=1`, `limit=50`, max `limit=200`)

```json
{ "ok": true, "total": 11, "page": 1, "limit": 50, "ouvriers": [ ... ] }
```

### `POST /api/ouvriers`
```json
// Body (matricule optionnel — généré automatiquement)
// Pour rattacher dès la création : departementId (uuid) OU departementNom (texte).
// Sans lien : on omet les deux champs.
{ "nom": "YAO", "prenom": "Esther", "departementId": "3fa8...", "photoUrl": null, "actif": true }
// Réponse 201 : { "ok": true, "ouvrier": { ... , departements: [...] } }
// Erreurs : 400 CHAMPS_MANQUANTS (nom/prenom manquant), 409 MATRICULE_EXISTANT
//           409 DOUBLON_DEPARTEMENT (même nom+prénom déjà rattaché à ce département,
//           comparaison insensible à la casse — aligné sur l'import)
// Contournement voluntaire : body { "force": true } → crée quand même (deux vraies
// personnes homonymes dans le même département).
```

### `GET /api/ouvriers/:id`
Détail complet d'un ouvrier (avec `departements`).

### `PATCH /api/ouvriers/:id`
Met à jour tout ou partie (nom, prenom, photoUrl, actif, matricule).
**Désactivation d'un badge** : `{ "actif": false }`.
> Le rattachement à un département ne se fait **pas** ici : utiliser les
> endpoints de la section 4‑bis (`/api/departements/:id/membres`).

### `PATCH /api/ouvriers/:id/activer` (protégé — ADMIN/SUPER_ADMIN)
Active le badge d'un ouvrier. Réponse : `{ "ok": true, "actif": true, "ouvrier": {...} }`.

### `PATCH /api/ouvriers/:id/desactiver` (protégé — ADMIN/SUPER_ADMIN)
Désactive le badge : le badgeage de ce matricule répondra `403 BADGE_DESACTIVE`. Réponse : `{ "ok": true, "actif": false, "ouvrier": {...} }`.

### `DELETE /api/ouvriers/:id`
Supprime l'ouvrier, ses pointages et ses liaisons départements (cascade).

### `GET /api/ouvriers/:id/badge`
Renvoie le **PNG du QR code** du badge (type `image/png`) — pour prévisualiser/imprimer.

### `GET /api/ouvriers/badges/zip`
Télécharge un **ZIP** contenant le QR code PNG de chaque ouvrier (un fichier par
ouvrier, nommé `<matricule>_<NOM>_<Prenom>.png`) — pour attribuer précisément
un badge imprimé à chaque ouvrier avant impression en masse.

Query optionnels :
- `actif=true|false` — filtre par état (défaut : tous)
- `departementId=uuid` — filtre par département (relation)

Réponse 200 : `application/zip`. Réponse 404 si aucun ouvrier ne correspond
aux filtres : `{ "ok": false, "code": "AUCUN_OUVRIER", ... }`.

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
- Le **département est créé automatiquement** s'il n'existe pas encore, puis
  l'ouvrier y est rattaché (poste `MEMBRE` par défaut).
- Si un ouvrier (même Nom+Prénom) existe déjà **et** est déjà dans ce
  département → ligne **ignorée** (doublon). S'il existe mais pas dans ce
  département → on ajoute juste la liaison.
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
      "ouvrier": {
        "id": "...", "matricule": "RSI-0001", "nom": "KOUAME", "prenom": "Aya",
        "departements": [ { "departement": { "id": "...", "nom": "Louange" } } ]
      }
    }
  ]
}
```

> `type` est présent mais **non utilisé** pour l'instant (toujours `ENTRER`).

---

## 4-bis. Départements (PROTÉGÉ — header `Authorization: Bearer <token>`)

### Modèle

Chaque ouvrier peut appartenir à **un ou plusieurs départements** avec un poste
par département (`roleDansDepartement`) :

| Poste | Nom (enum `RoleDepartement`) |
|---|---|
| Responsable | `RESPONSABLE` |
| Adjoint | `ADJOINT` |
| Secrétaire | `SECRETAIRE` |
| Simple membre | `MEMBRE` (défaut) |

**Contraintes** :
- Un seul `RESPONSABLE` et un seul `ADJOINT` par département → `409 POSTE_DEJA_PRIS`.
- Un ouvrier ne peut pas être deux fois dans le même département (unicité `ouvrierId + departementId`).

### `GET /api/departements`
Liste les départements (triée par nom). Query optionnels : `page=1&limit=50`.
```json
{
  "ok": true, "total": 15, "page": 1, "limit": 50,
  "departements": [
    { "id": "...", "nom": "Louange", "description": null, "createdAt": "...",
      "_count": { "membres": 5 } }
  ]
}
```
Lectures ouvertes à **tous les rôles authentifiés** (y compris `LECTEUR`).

### `GET /api/departements/:id`
Détail du département **avec ses membres** (chaque membre inclut l'ouvrier et son poste).
```json
{
  "ok": true,
  "departement": {
    "id": "...", "nom": "Louange", "description": null,
    "membres": [
      { "id": "...", "roleDansDepartement": "RESPONSABLE",
        "ouvrier": { "id": "...", "matricule": "RSI-0001", "nom": "KOUAME", "prenom": "Aya", "actif": true } }
    ]
  }
}
```
Erreurs : `404 DEPARTEMENT_INCONNU`.

### `GET /api/departements/:id/membres`
Identique à `GET /:id` mais réponse allégée :
```json
{ "ok": true, "departement": { "id": "...", "nom": "Louange" },
  "membres": [ { "id": "...", "roleDansDepartement": "MEMBRE", "ouvrier": {...} } ] }
```

### `POST /api/departements` (écriture — **ADMIN/SUPER_ADMIN**)
```json
// Body
{ "nom": "Louange", "description": "Musique et chants" }
// Réponse 201 : { "ok": true, "departement": { "id", "nom", "description", "createdAt" } }
// Erreurs : 400 CHAMPS_MANQUANTS (nom requis), 409 DEPARTEMENT_EXISTANT
```

### `PATCH /api/departements/:id` (écriture — **ADMIN/SUPER_ADMIN**)
Change `nom` et/ou `description`.
Erreurs : `404 DEPARTEMENT_INCONNU`, `409 DEPARTEMENT_EXISTANT`, `400 AUCUNE_DONNEE`.

### `DELETE /api/departements/:id` (écriture — **ADMIN/SUPER_ADMIN**)
Supprime le département et toutes ses liaisons (cascade).
Erreur : `404 DEPARTEMENT_INCONNU`.

### `POST /api/departements/:id/membres` (écriture — **ADMIN/SUPER_ADMIN**)
Ajoute un ouvrier **existant** à un département (ou modifie son poste s'il y est déjà). Upsert.
```json
// Body
{ "ouvrierId": "uuid", "roleDansDepartement": "RESPONSABLE" }
// roleDansDepartement optionnel (défaut : MEMBRE)
// Réponse 201 : { "ok": true, "liaison": { "id", "ouvrierId", "departementId", "roleDansDepartement",
//                 "ouvrier": {...}, "departement": {...} } }
// Erreurs : 400 CHAMPS_MANQUANTS / ROLE_INVALIDE, 404 DEPARTEMENT_INCONNU / OUVRIER_INCONNU,
//           409 POSTE_DEJA_PRIS
```

### `PATCH /api/departements/:id/membres/:ouvrierId` (écriture — **ADMIN/SUPER_ADMIN**)
Change le poste d'un membre dans le département.
```json
// Body
{ "roleDansDepartement": "ADJOINT" }
// Réponse 200 : { "ok": true, "liaison": {...} }
// Erreurs : 400 CHAMPS_MANQUANTS / ROLE_INVALIDE, 404 DEPARTEMENT_INCONNU / MEMBRE_INCONNU,
//           409 POSTE_DEJA_PRIS
```

### `DELETE /api/departements/:id/membres/:ouvrierId` (écriture — **ADMIN/SUPER_ADMIN**)
Retire un ouvrier du département.
Réponse : `{ "ok": true }`. Erreurs : `404 DEPARTEMENT_INCONNU` / `404 MEMBRE_INCONNU`.

> **Filtres par département pour l'équipe front** : pour afficher « les membres
> d'un département », utiliser `GET /api/departements/:id` (ou `/membres`).
> Pour filtrer la liste des ouvriers par département, deux options :
> 1. Côté backend : `GET /api/ouvriers/badges/zip?departementId=...` (export),
> 2. Côté front : récupérer les membres du département puis afficher.
> Un filtre `GET /api/ouvriers?departementId=...` est prévu si l'équipe le juge utile.

---

## 6. Divers

- `GET /api/health` — public, `{ "status": "ok", ... }`. Utilisé par les healthcheck Railway/Render.
- Toute route inconnue → `404 { "ok": false, "code": "ROUTE_INCONNUE", ... }`

---

## Journal des changements de contrat

| Date | Changement |
|---|---|
| 2026-09-05 | **Anti doublon** : `POST /api/ouvriers` refuse toute création dont le nom+prénom existent déjà dans le département ciblé (comparaison insensible à la casse, aligné sur l'import) → `409 DOUBLON_DEPARTEMENT` ; l'import applique désormais aussi une comparaison insensible à la casse ; contournement volontaire : `{"force": true}` (deux vraies personnes homonymes) |
| 2026-09-04 | **Départements** : ajout de la section 4-bis (`/api/departements` CRUD + membres + postes `RESPONSABLE/ADJOINT/SECRETAIRE/MEMBRE`) ; `GET /api/ouvriers` et `GET /api/ouvriers/:id` renvoient la relation `departements` (plus de champ string) ; `POST /api/ouvriers` accepte `departementId`/`departementNom` ; import : le département est créé automatiquement + rattachement ; `GET /api/ouvriers/badges/zip` filtre désormais par `departementId` |
| 2026-09-04 | Badgeage : ajout du **anti double-badge** (une fois par jour civil) → `409 DEJA_BADGE_AUJOURDHUI` |
| 2026-09-04 | Ajout de `GET /api/ouvriers/badges/zip` (ZIP de tous les QR codes, filtrable par `actif`/`departement`) |
| 2026-09-03 | Ajout de `POST /api/ouvriers/import` (import massif .csv/.xlsx + QR auto) |
| 2026-09-03 | Ajout des rôles (`RoleAdmin`) : login/me renvoient `role`, register réservé au SUPER_ADMIN, écritures ouvriers/import réservées à ADMIN/SUPER_ADMIN |
| 2026-09-03 | Register rendu **public** (tout inscrit = `LECTEUR`) + ajout de `GET /api/admins` et `PATCH /api/admins/:id/role` (gestion des rôles par SUPER_ADMIN, auto-rétrogradation bloquée) |
| 2026-09-03 | Ajout de `PATCH /api/ouvriers/:id/activer` et `PATCH /api/ouvriers/:id/desactiver` (endpoints dédiés actif/inactif) |
| 2026-09-01 | Création du document (v1) — badgeage, auth, ouvriers, pointages |