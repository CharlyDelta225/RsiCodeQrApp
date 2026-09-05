# RsiCodeQrApp — Badgeage QR pour ouvriers d'église

Système de **badgeage par QR code** : chaque ouvrier reçoit un badge avec un QR code ; une douchette scanne le QR au kiosque (terminal), le matricule est envoyé à l'API qui enregistre le pointage et renvoie les infos de l'ouvrier. Un dashboard permet à l'équipe de gérer les ouvriers, les départements et de consulter l'historique.

**Monorepo** : backend API (notre travail) + deux dossiers frontend réservés à l'équipe frontend.

```
RsiCodeQrApp/
├── backend/                ← API Node.js/Express + PostgreSQL/Prisma
│   ├── src/                ← code applicatif
│   │   ├── routes/         ← endpoints (badgeage, auth, ouvriers, pointages, admins, import, départements)
│   │   ├── middleware/     ← requireAuth + requireRole
│   │   ├── lib/            ← prisma client, générateur de matricule
│   │   └── scripts/        ← seed, reset-admin-password
│   ├── prisma/             ← schéma + migrations
│   ├── tests/              ← tests d'intégration (node:test)
│   ├── data/               ← exemple de fichier CSV
│   └── public/badges/      ← QR codes générés (à imprimer)
├── frontend/dashboard/     ← gestion + historique (dashboard maintenu avec le backend)
├── frontend/terminal/      ← (équipe front) kiosque de badgeage
└── docs/api-contrat.md     ← contrat d'API partagé avec l'équipe front
```

---

## Technologies

- **Backend** : Node.js (ESM) + Express 5
- **Base de données** : PostgreSQL 18 + Prisma ORM 6
- **Auth** : JWT (jsonwebtoken) + bcryptjs + `express-rate-limit` (anti brute-force)
- **QR codes** : `qrcode` (PNG) + `archiver` (ZIP bulk)
- **Import** : `multer` (upload) + `xlsx` (parse .csv et .xlsx)
- **Sécurité** : CORS restreint, limites de corps/fichier, rôles (moindre privilège)
- **Déploiement** : préparation Railway (`railway.toml`) et Render (`render.yaml`)

---

## Installation et lancement (développement local)

Prérequis : Node.js 18+, PostgreSQL en cours d'exécution.

```bash
# 1. Installer les dépendances du backend
cd backend
npm install

# 2. Configurer les variables d'environnement
cp .env.example .env   # puis remplir DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

# 3. Appliquer le schéma de base de données
npm run prisma:migrate  # (prisma migrate dev --name init)

# 4. (Optionnel) Remplir avec des données d'exemple + admin SUPER_ADMIN
npm run seed

# 5. Lancer le serveur
npm start               # => http://localhost:3000
```

Vérifier : `GET /api/health` → `{ "status": "ok", ... }`

### Lancer le dashboard (frontend)

```bash
cd frontend/dashboard
npm install
npm run dev             # => http://localhost:5174
```

> En dev, `VITE_API_URL` est vide : le dashboard appelle `/api/...` via le
> proxy Vite vers `http://localhost:3000` (voir `vite.config.js`). En prod,
> renseigner `VITE_API_URL` avec l'URL du backend.

> Connexion avec le compte seed : `admin@example.com` / `change-moi`

Pages du dashboard :

| Route | Contenu |
|---|---|
| `/` | Tableau de bord : KPIs, pointages récents |
| `/ouvriers` | Gestion des ouvriers (CRUD, import `.csv`/`.xlsx`) |
| `/badges` | Badges QR (aperçu, ZIP d'impression) |
| `/pointages` · `/historique` | Pointages du jour · historique filtrable/exportable |
| `/departements` | Membres et postes par département |
| `/gestion-departements` | Créer / lister / renommer / exporter les départements |

> Les listes du dashboard sont **paginées à 17 éléments par page** ; la
> suppression d'un département et la déconnexion passent par un popup de
> confirmation.

### Terminal kiosque

Le terminal est servi directement par le backend : http://localhost:3000/terminal

> Sur Windows, npm 11 bloque les scripts d'installation des moteurs Prisma : la config `allowScripts` dans `backend/package.json` règle ce point. Le miroir `registry.npmmirror.com` dans `.npmrc` facilite l'install si le réseau est instable.

---

## Rôles et permissions

| Rôle | Lire ouvriers/pointages | Écrire ouvriers / import | Gérer les rôles |
|---|---|---|---|
| `LECTEUR` | ✅ | ❌ | ❌ |
| `ADMIN` | ✅ | ✅ | ❌ |
| `SUPER_ADMIN` | ✅ | ✅ | ✅ |

- **Inscription** (`POST /api/auth/register`) est **publique** : tout compte naît `LECTEUR`.
- **Élévation de rôle** : un `SUPER_ADMIN` change le rôle via `PATCH /api/admins/:id/role` depuis le dashboard.
- **Anti-verrouillage** : un `SUPER_ADMIN` ne peut pas modifier son propre rôle.

---

## Sécurité

| Protection | Détail |
|---|---|
| **Anti brute-force** | `login` / `register` limités à **5 tentatives/min/IP** → `429 TROP_DE_TENTATIVES` |
| **CORS restreint** | seules origines dashboard (dev 5173/5174) + même origine acceptée (terminal) ; autre → `403 ORIGINE_NON_AUTORISEE` |
| **Corps JSON limité** | 100 ko max → `413 CORPS_TROP_GROS` |
| **Import borné** | fichier ≤ 5 Mo (`413 FICHIER_TROP_GROS`) et ≤ 2000 lignes (`400 TROP_DE_LIGNES`) |
| **Matricule unique** | génération avec **retry** sur collision `P2002` (2 requêtes simultanées ne produisent plus `409 MATRICULE_EXISTANT` pour un matricule auto) |
| **Réponses d'erreur** | jamais de stack technique ; code machine `{ ok, code, message }` |
| **Moindre privilège** | rôle `LECTEUR` par défaut à l'inscription, écritures réservées `ADMIN`/`SUPER_ADMIN` |

En production (hébergement), définir `CORS_ORIGINES` avec le/les domaine(s) du dashboard (voir `backend/.env.example`).

---

## Modèle de données — Départements

Les ouvriers sont rattachés à un ou **plusieurs départements** via une table de jonction `OuvrierDepartement` avec un poste par département.

```
Ouvrier ──< OuvrierDepartement >── Departement
                  roleDansDepartement
                  (RESPONSABLE / ADJOINT / SECRETAIRE / MEMBRE)
```

- **Un seul RESPONSABLE** par département (vérif côté back).
- **Un seul ADJOINT** par département (idem).
- Un ouvrier peut être dans **plusieurs départements** (chorale + accueil par ex.).

---

## Principaux endpoints

### Badgeage (public)

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/api/badgeage` | Badgeage : `{ "matricule" }` → infos ouvrier + pointage |

### Authentification

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | public | Connexion → token JWT |
| `POST` | `/api/auth/register` | public | Créer un compte (LECTEUR) |
| `GET` | `/api/auth/me` | authentifié | Infos du compte |

### Admins (SUPER_ADMIN)

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/admins` | Liste des comptes |
| `PATCH` | `/api/admins/:id/role` | Changer un rôle |

### Ouvriers

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| `GET` | `/api/ouvriers` | tous | Liste paginée + recherche |
| `POST` | `/api/ouvriers` | ADMIN/SUPER | Créer (accepte `departementId` ou `departementNom`) |
| `PATCH` | `/api/ouvriers/:id` | ADMIN/SUPER | Modifier |
| `PATCH` | `/api/ouvriers/:id/activer` | ADMIN/SUPER | Activer le badge |
| `PATCH` | `/api/ouvriers/:id/desactiver` | ADMIN/SUPER | Désactiver le badge |
| `DELETE` | `/api/ouvriers/:id` | ADMIN/SUPER | Supprimer (+ pointages + liaisons) |
| `GET` | `/api/ouvriers/:id/badge` | tous | PNG du QR code |
| `GET` | `/api/ouvriers/badges/zip` | tous | ZIP de tous les badges QR |
| `POST` | `/api/ouvriers/import` | ADMIN/SUPER | Import massif .csv/.xlsx + QR auto |

### Départements

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| `GET` | `/api/departements` | tous | Liste avec compteurs membres |
| `GET` | `/api/departements/:id` | tous | Détail + membres |
| `GET` | `/api/departements/:id/membres` | tous | Membres détaillés |
| `POST` | `/api/departements` | ADMIN/SUPER | Créer un département |
| `PATCH` | `/api/departements/:id` | ADMIN/SUPER | Modifier |
| `DELETE` | `/api/departements/:id` | ADMIN/SUPER | Supprimer |
| `POST` | `/api/departements/:id/membres` | ADMIN/SUPER | Ajouter/affecter un ouvrier (avec poste) |
| `PATCH` | `/api/departements/:id/membres/:ouvrierId` | ADMIN/SUPER | Changer le poste |
| `DELETE` | `/api/departements/:id/membres/:ouvrierId` | ADMIN/SUPER | Retirer un membre |

### Pointages

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| `GET` | `/api/pointages` | tous | Historique (filtres du/au, ouvrier, pagination) |

Le contrat détaillé (formats de requête/réponse, codes d'erreur) est dans **`docs/api-contrat.md`**.

---

### Import massif d'ouvriers

Le fichier (`.csv` ou `.xlsx`) doit contenir **exactement** 3 colonnes dans l'en-tête :

```csv
Nom,Prénom,Département
KEITA,Awa,Chorale
FOFANA,Ibrahim,Logistique
```

- Le **matricule** est auto-généré (`RSI-XXXX`) et le **QR badge** créé automatiquement.
- **Limites** : fichier ≤ 5 Mo et ≤ 2000 lignes de données.
- Le département doit **exister dans la base** (table `Departement`) : si le
  fichier en référence un d'inconnu, **tout l'import est refusé**
  (`400 DEPARTEMENT_INCONNU`) — aucun département n'est créé automatiquement.
  La page « Gestion des départements » du dashboard permet de créer/renommer
  la liste avant l'import.
- Si l'ouvrier (nom+prénom) existe déjà, on ajoute juste la liaison au département.
- Doublons (même Nom+Prénom+Département) → ignorés ; champs vides → ligne en erreur.

```powershell
curl.exe -X POST http://localhost:3000/api/ouvriers/import `
  -H "Authorization: Bearer <token>" -F "fichier=@ouvriers.csv"
```

---

## Tests

```bash
cd backend
node --test "tests/*.test.js"
```

---

## Déploiement (Railway / Render)

Le backend se déploie avec **Root Directory = `backend`**.

Chaîne au démarrage : `npx prisma migrate deploy && npm start`
- `migrate deploy` applique les migrations en attente (sans interaction),
- `npm start` régénère le client Prisma puis lance Express.

Variables d'environnement requises :
- `DATABASE_URL` (PostgreSQL fourni par la plateforme)
- `JWT_SECRET` (secret aléatoire)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` (compte SUPER_ADMIN du seed)
- `PUBLIC_BASE_URL` (URL publique du backend, ex. `https://mon-api.railway.app`)
- `CORS_ORIGINES` (origines du dashboard, séparées par des virgules, ex. `https://mon-dashboard.vercel.app`)
- `PORT` (défaut 3000)

Après déploiement : vérifier `GET /api/health`, puis lancer le seed et l'import d'ouvriers via la console du service.
