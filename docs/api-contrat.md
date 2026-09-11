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
| Rôle | Ouvriers (lecture) | Ouvriers (écriture/import) | Pointages | Départements (gestion) | Gestion des comptes (`/api/admins`) |
|---|---|---|---|---|---|
| `LECTEUR` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `ADMIN` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `SUPER_ADMIN` | ✅ | ✅ | ✅ | ✅ | ✅ |

### `POST /api/auth/login` (PUBLIC)
```json
// Body
{ "email": "admin@example.com", "motDePasse": "change-moi" }

// Réponse 200
{ "ok": true, "token": "<JWT>", "admin": { "id": "...", "email": "...", "role": "SUPER_ADMIN" } }

// Erreurs
// 400 { "ok": false, "code": "CHAMPS_MANQUANTS", ... }
// 401 { "ok": false, "code": "IDENTIFIANTS_INVALIDES", "reste": 2, ... }
//      "reste" = tentatives restantes AVANT blocage (3 par défaut)
// 423 { "ok": false, "code": "COMPTE_BLOQUE", "reste": 15, ... }
//      compte gelé 15 min après 3 échecs (reste = minutes)
// 403 { "ok": false, "code": "COMPTE_DESACTIVE", ... } compte désactivé
```

> **Blocage anti brute-force** : après **3 mots de passe erronés**, le compte
> est gelé **15 minutes** (`423 COMPTE_BLOQUE`, `reste` = minutes restantes).
> Un déblocage manuel par le SUPER_ADMIN est possible (`PATCH /api/admins/:id/debloquer`).
> Un **bon** mot de passe remet le compteur à zéro. Un email inconnu reçoit la
> même réponse qu'un mauvais mot de passe (anti-énumération, sans `reste`).

### `POST /api/auth/reset-demand` (PUBLIC, rate-limité)
Demande d'un lien de réinitialisation de mot de passe par email (lien à usage
unique, valable **1 heure**). Répond **toujours** `{ ok: true }` (même si
l'email est inconnu) pour ne pas révéler quels comptes existent.
```json
// Body
{ "email": "admin@example.com" }

// Réponse 200
{ "ok": true, "emailEnvoye": true,
  "message": "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé." }
// emailEnvoye=false si SMTP non configuré ou échec d'envoi (le compte existe)
```

### `POST /api/auth/reset` (PUBLIC)
Pose un nouveau mot de passe grâce au lien reçu par email. Le lien est
consommé (stocké haché en base, à usage unique), et le blocage éventuel est levé.
```json
// Body
{ "token": "<token du lien>", "motDePasse": "NouveauMdp456!" }

// Réponse 200
{ "ok": true, "message": "Mot de passe réinitialisé. Vous pouvez vous connecter." }

// Erreurs
// 400 motDePasse < 8 ou token absent  → CHAMPS_MANQUANTS / MOT_DE_PASSE_TROP_COURT
// 400 lien inconnu ou expiré           → LIEN_INVALIDE_OU_EXPIRE
// 403 compte désactivé                 → COMPTE_DESACTIVE
```

### `GET /api/auth/me` (protégé)
Renvoie l'admin connecté : `{ "ok": true, "admin": { "id", "email", "role", "createdAt" } }`

### `POST /api/auth/register` (PUBLIC)
Création d'un compte. Tout nouveau compte naît **`LECTEUR`** et **`actif`**.
L'élévation vers `ADMIN`/`SUPER_ADMIN` se fait ensuite par un `SUPER_ADMIN`
via `PATCH /api/admins/:id/role`.
```json
// Body
{ "email": "lambda@eglise.com", "motDePasse": "lambda123" }
// (rôle NON accepté ici : tout inscrit est LECTEUR, le rôle fourni est ignoré)

// Réponse 201
{ "ok": true, "admin": { "id": "...", "email": "...", "role": "LECTEUR", "actif": true, "createdAt": "..." } }

// Erreurs
// 400 motDePasse < 8 → MOT_DE_PASSE_TROP_COURT
// 409 email déjà pris → EMAIL_EXISTANT
```

### `POST /api/admins` (protégé — **SUPER_ADMIN uniquement**)
Crée un compte admin. Le **mot de passe est envoyé par email** (`motDePasseTemporaire`
dans la réponse si SMTP non configuré). Le compte naît `LECTEUR` et `actif`.
```json
// Body
{ "email": "nouveau@eglise.com" }

// Réponse 201
{ "ok": true, "admin": { "id": "...", "email": "...", "role": "LECTEUR", "actif": true, "createdAt": "..." },
  "emailEnvoye": true }

// Erreurs
// 400 CHAMPS_MANQUANTS (email requis)
// 409 EMAIL_EXISTANT
```

### `GET /api/admins` (protégé — **SUPER_ADMIN uniquement**)
Liste tous les comptes admin (avec champs `actif`, `tentativesEchouees`, `bloqueJusqua`).
```json
{ "ok": true, "admins": [ { "id": "...", "email": "...", "role": "LECTEUR", "actif": true,
                             "tentativesEchouees": 0, "bloqueJusqua": null, "createdAt": "..." } ] }
```

### `PATCH /api/admins/:id/role` (protégé — **SUPER_ADMIN uniquement**)
Change le rôle d'un compte admin.
```json
// Body
{ "role": "ADMIN" }   // valeurs : ADMIN | LECTEUR | SUPER_ADMIN

// Réponse 200
{ "ok": true, "admin": { "id": "...", "email": "...", "role": "ADMIN", "actif": true, "createdAt": "..." } }

// Erreurs
// 400 ROLE_INVALIDE
// 404 ADMIN_INCONNU
// 403 ACTION_IMPOSSIBLE (auto-rétrogradation ou on ne peut modifier son propre rôle)
```

### `PATCH /api/admins/:id/activer` (protégé — **SUPER_ADMIN uniquement**)
Réactive un compte désactivé.
```json
// Réponse 200 : { "ok": true, "admin": { ..., "actif": true } }
// Erreurs : 404 ADMIN_INCONNU, 403 ACTION_IMPOSSIBLE (déjà actif)
```

### `PATCH /api/admins/:id/desactiver` (protégé — **SUPER_ADMIN uniquement**)
Désactive un compte (le front redirige vers la page d'erreur `COMPTE_DESACTIVE`).
```json
// Réponse 200 : { "ok": true, "admin": { ..., "actif": false } }
// Erreurs : 404 ADMIN_INCONNU, 403 ACTION_IMPOSSIBLE (déjà inactif, ou auto-désactivation)
```

### `PATCH /api/admins/:id/debloquer` (protégé — **SUPER_ADMIN uniquement**)
Déverrouille un compte gelé après 3 échecs.
```json
// Réponse 200 : { "ok": true, "admin": { ..., "tentativesEchouees": 0, "bloqueJusqua": null } }
// Erreurs : 404 ADMIN_INCONNU
```

### `POST /api/admins/:id/reinitialiser-mot-de-passe` (protégé — **SUPER_ADMIN uniquement**)
Génère un nouveau mot de passe temporaire et l'envoie par email.
```json
// Réponse 200
{ "ok": true, "admin": { "id": "...", "email": "...", "role": "..." },
  "emailEnvoye": true, "motDePasseTemporaire": "AbCDe123" }
// motDePasseTemporaire : présent SEULEMENT si l'envoi email a échoué
// Erreurs : 404 ADMIN_INCONNU, 403 ACTION_IMPOSSIBLE (auto-réinitialisation)
```

### `DELETE /api/admins/:id` (protégé — **SUPER_ADMIN uniquement**)
Supprime un compte admin.
```json
// Réponse 200 : { "ok": true }
// Erreurs : 404 ADMIN_INCONNU, 403 ACTION_IMPOSSIBLE (auto-suppression ou dernier SUPER_ADMIN)
```

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

### `GET /api/ouvriers/badges/zip` (protégé — **ADMIN/SUPER_ADMIN**)
Télécharge un **ZIP** contenant le QR code PNG de chaque ouvrier (un fichier par
ouvrier, nommé `<matricule>_<NOM>_<Prenom>.png`) — pour attribuer précisément
un badge imprimé à chaque ouvrier avant impression en masse.

Query optionnels :
- `actif=true|false` — filtre par état (défaut : tous)
- `departementId=uuid` — filtre par département (relation)

Réponse 200 : `application/zip`. Réponse 404 si aucun ouvrier ne correspond
aux filtres : `{ "ok": false, "code": "AUCUN_OUVRIER", ... }`.
Un `LECTEUR` reçoit `403 ACCES_REFUSE` : l'extraction de masse est réservée
aux rôles à écriture (la consultation d'un badge seul reste ouverte).

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
- Le département doit **exister dans le référentiel** (table `Departement`).
  Si le fichier en référence un d'inconnu → **tout l'import est refusé**
  `400 DEPARTEMENT_INCONNU`. Aucun département n'est auto-créé.
- Si un ouvrier (même Nom+Prénom) existe déjà **et** est déjà dans ce
  département → ligne **ignorée** (doublon). S'il existe mais pas dans ce
  département → on ajoute juste la liaison.
- Champ requis vide → ligne marquée en **erreur**

```json
{
  "ok": false, "code": "DEPARTEMENT_INCONNU",
  "message": "Département(s) introuvable(s) dans la base : Media, Enfants. Veuillez choisir des départements de la liste existante."
}
```

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

## 5. Rapports de pointage (PROTÉGÉ — header `Authorization: Bearer <token>`)

### Contexte

Les jours de **programme** de l'église sont : **Mercredi, Vendredi, Dimanche**.
Présence d'un ouvrier (il ne badge qu'**une** fois par jour) :

| Jour | Présent si badge ≤ |
|---|---|
| Mercredi | 21h30 |
| Vendredi | 21h30 |
| Dimanche | 12h00 |
| Tout autre jour (route manuelle) | **badgé = présent** (aucun seuil) |

### `GET /api/rapports/journalier` (lecture — tout rôle authentifié)

Retourne la structure d'un rapport **sans envoyer d'email** (pour la page
Rapport du dashboard : filtre + affichage présent/absent + export CSV).

**Query optionnels** :
```text
?date=2026-09-09            AAAA-MM-JJ (défaut : aujourd'hui)
&departementId=<id>          filtre sur un département (défaut : tous) —
                             le `recap` est recalculé sur la sélection
```

**Réponse 200** :
```json
{
  "ok": true,
  "rapport": {
    "dateISO": "2026-09-09",
    "dateLongueur": "Mercredi 9 septembre 2026",
    "jourLabel": "Mercredi",
    "seuilTexte": "21:30",
    "notePresence": "Statut : présent si badge ≤ 21:30",
    "programme": true,
    "departements": [
      {
        "id": "0a4939e7-...",
        "nom": "SÉCURITÉ",
        "presents": 12,
        "absents": 6,
        "effectif": 18,
        "lignes": [ { "matricule": "RSI-0001", "nom": "KOUASSI", "prenom": "Jean", "present": true, "heure": "19:42" } ]
      }
    ],
    "recap": { "presents": 120, "absents": 70, "effectif": 190 }
  }
}
```

**Réponses d'erreur** :
| HTTP | code | message |
|---|---|---|
| 400 | `DATE_INVALIDE` | Date illisible (format `AAAA-MM-JJ`) |
| 404 | `DEPARTEMENT_INCONNU` | `departementId` introuvable |

### `POST /api/rapports/journalier` (écriture — **ADMIN/SUPER_ADMIN**)

Génère les PDF (un par département + **récapitulatif**) de la date demandée et
les **envoie par email** en pièces jointes. **Fonctionne n'importe quel jour** :
sur un jour de programme le seuil s'applique, sur un autre jour « badgé » suffit.

**Body optionnel** :
```json
{ "date": "2026-09-09",                     // AAAA-MM-JJ (défaut : aujourd'hui)
  "destinataires": ["a@x.fr", "b@x.fr"] }   // destinataires (défaut : RAPPORT_EMAIL_DESTINATAIRES)
```

**Réponse 200** :
```json
{
  "ok": true,
  "rapport": {
    "dateISO": "2026-09-09",
    "jourLabel": "Mercredi",
    "seuilTexte": "21:30",
    "departements": [ { "id": "0a4939e7-...", "nom": "SÉCURITÉ", "presents": 12, "absents": 6, "effectif": 18 } ],
    "recap": { "presents": 120, "absents": 70, "effectif": 190 }
  },
  "email": { "destinataires": ["a@x.fr"], "messageId": "<...>" }
}
```

**Réponses d'erreur** :
| HTTP | code | message |
|---|---|---|
| 400 | `DATE_INVALIDE` | Date illisible (format `AAAA-MM-JJ`) |
| 400 | `SMTP_NON_CONFIGURE` | `SMTP_HOST` absent du `.env` |
| 400 | `SANS_DESTINATAIRE` | ni paramètre ni `RAPPORT_EMAIL_DESTINATAIRES` |
| 400 | `ENVOI_EMAIL_ECHOUE` | L'envoi SMTP a échoué (message SMTP précisé) |
| 500 | `ERREUR_INTERNE` | Erreur interne |

### Envoi programmé (automatique)

Chaque matin à **06h00** (heure locale du serveur), le backend envoie
automatiquement le rapport du **jour de programme précédent** :

| Matin | Rapport envoyé |
|---|---|
| Jeudi 06h00 | Mercredi |
| Samedi 06h00 | Vendredi |
| Lundi 06h00 | Dimanche |

Destinataires : `RAPPORT_EMAIL_DESTINATAIRES` (variable d'environnement,
**plusieurs adresses séparées par des virgules**).
Un même rapport n'est envoyé **qu'une fois** par session serveur.

**Variables `.env` requises** :
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=moncompte@gmail.com
SMTP_PASS=xxxx
SMTP_EXPEDITEUR="Rapports <moncompte@gmail.com>"  # optionnel (défaut : SMTP_USER)
RAPPORT_EMAIL_DESTINATAIRES=responsable@eglise.ci,secretariat@eglise.ci
```

---

## 6. Divers

- `GET /api/health` — public, `{ "status": "ok", ... }`. Utilisé par les healthcheck Railway/Render.
- Toute route inconnue → `404 { "ok": false, "code": "ROUTE_INCONNUE", ... }`

---

## Journal des changements de contrat

| Date | Changement |
|---|---|
| 2026-09-11 | **Sécurité authentification** : login avec compteur de tentatives (`reste`), blocage 15 min après 3 échecs (`423 COMPTE_BLOQUE`), déblocage manuel `PATCH /admins/:id/debloquer` ; demandation reset par email `POST /reset-demand` + lien à usage unique (1h) + `POST /reset` ; `POST /admins` crée un compte et envoie le mot de passe par email ; `PATCH /admins/:id/activer|desactiver`, `POST /admins/:id/reinitialiser-mot-de-passe`, `DELETE /admins/:id` ; tableau rôles enrichi (Départements gestion, Gestion comptes) ; role `actif` ajouté au modèle Admin |
| 2026-09-11 | **Extractions réservées à ADMIN/SUPER_ADMIN** : `GET /api/ouvriers/badges/zip` passe de « tous » à **ADMIN/SUPER_ADMIN** (`403 ACCES_REFUSE` pour LECTEUR). Côté dashboard, les exports CSV (rapports, historique, départements) et les téléchargements de badges sont masqués pour un `LECTEUR` (lecture seule) |
| 2026-09-08 | **Page Rapport (dashboard `/rapports`)** : ajout de `GET /api/rapports/journalier` (lecture, filtre `date` + `departementId`, `recap` recalculé), tableau présent/absent, export CSV (colonne `Date`), envoi email manuel ; `RAPPORT_EMAIL_DESTINATAIRES` multi-adresses (séparées par des virgules) |
| 2026-09-07 | **Rapports de pointage** : ajout de la section 5 — `POST /api/rapports/journalier` (PDF par département + récap, envoi email SMTP) + envoi automatique chaque matin 06h00 du rapport du jour de programme précédent (Mer/Jeu, Ven/Sam, Dim/Lun). Règle de présence : Mercredi/Vendredi ≤ 21h30, Dimanche ≤ 12h00. **La route manuelle fonctionne n'importe quel jour** (hors programme : badgé = présent). Env `SMTP_*` et `RAPPORT_EMAIL_DESTINATAIRES` |
| 2026-09-05 | **Durcissement sécurité** : rate-limit sur `POST /api/auth/login` et `/register` (5 tentatives/min/IP) → `429 TROP_DE_TENTATIVES` ; CORS restreint aux origines du dashboard (variable `CORS_ORIGINES`, défauts 5173/5174) → `403 ORIGINE_NON_AUTORISEE` ; corps JSON limité à 100 ko → `413 CORPS_TROP_GROS` ; fichier d'import > 5 Mo → `413 FICHIER_TROP_GROS` ; import > 2000 lignes → `400 TROP_DE_LIGNES` ; matricule auto-généré avec retry sur collision unique (l'erreur `409 MATRICULE_EXISTANT` ne peut plus survenir pour un matricule généré) |
| 2026-09-05 | **Import strict sur les départements** : l'import refuse tout fichier contenant au moins un département absent du référentiel → `400 DEPARTEMENT_INCONNU` (l'auto-création de département est supprimée) |
| 2026-09-05 | **Anti doublon** : `POST /api/ouvriers` refuse toute création dont le nom+prénom existent déjà dans le département ciblé (comparaison insensible à la casse, aligné sur l'import) → `409 DOUBLON_DEPARTEMENT` ; l'import applique désormais aussi une comparaison insensible à la casse ; contournement volontaire : `{"force": true}` (deux vraies personnes homonymes) |
| 2026-09-04 | **Départements** : ajout de la section 4-bis (`/api/departements` CRUD + membres + postes `RESPONSABLE/ADJOINT/SECRETAIRE/MEMBRE`) ; `GET /api/ouvriers` et `GET /api/ouvriers/:id` renvoient la relation `departements` (plus de champ string) ; `POST /api/ouvriers` accepte `departementId`/`departementNom` ; import : le département est créé automatiquement + rattachement ; `GET /api/ouvriers/badges/zip` filtre désormais par `departementId` |
| 2026-09-04 | Badgeage : ajout du **anti double-badge** (une fois par jour civil) → `409 DEJA_BADGE_AUJOURDHUI` |
| 2026-09-04 | Ajout de `GET /api/ouvriers/badges/zip` (ZIP de tous les QR codes, filtrable par `actif`/`departement`) |
| 2026-09-03 | Ajout de `POST /api/ouvriers/import` (import massif .csv/.xlsx + QR auto) |
| 2026-09-03 | Ajout des rôles (`RoleAdmin`) : login/me renvoient `role`, register réservé au SUPER_ADMIN, écritures ouvriers/import réservées à ADMIN/SUPER_ADMIN |
| 2026-09-03 | Register rendu **public** (tout inscrit = `LECTEUR`) + ajout de `GET /api/admins` et `PATCH /api/admins/:id/role` (gestion des rôles par SUPER_ADMIN, auto-rétrogradation bloquée) |
| 2026-09-03 | Ajout de `PATCH /api/ouvriers/:id/activer` et `PATCH /api/ouvriers/:id/desactiver` (endpoints dédiés actif/inactif) |
| 2026-09-01 | Création du document (v1) — badgeage, auth, ouvriers, pointages |