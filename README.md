# RsiCodeQrApp — Badgeage QR pour ouvriers d'église

Système de **badgeage par QR code** : chaque ouvrier reçoit un badge avec un QR code ; une douchette scanne le QR au kiosque (terminal), le matricule est envoyé à l'API qui enregistre le pointage et renvoie les infos de l'ouvrier. Un dashboard permet à l'équipe de gérer les ouvriers et de consulter l'historique.

**Monorepo** : backend API (notre travail) + deux dossiers frontend réservés à l'équipe frontend.

```
RsiCodeQrApp/
├── backend/                ← API Node.js/Express + PostgreSQL/Prisma
│   ├── src/                ← code applicatif
│   │   ├── routes/         ← endpoints (badgeage, auth, ouvriers, pointages, admins, import)
│   │   ├── middleware/     ← requAuth + requireRole
│   │   ├── lib/            ← prisma client, générateur de matricule
│   │   └── scripts/        ← seed, import CSV, génération de badges
│   ├── prisma/             ← schéma + migrations
│   ├── tests/              ← tests d'intégration (node:test)
│   ├── data/               ← exemple de fichier CSV
│   ├── public/badges/      ← QR codes générés (à imprimer)
│   └── docs/ → ../docs
├── frontend/dashboard/     ← (équipe front) gestion + historique
├── frontend/terminal/      ← (équipe front) kiosque de badgeage
└── docs/api-contrat.md     ← contrat d'API partagé avec l'équipe front
```

---

## Technologies

- **Backend** : Node.js (ESM) + Express 5
- **Base de données** : PostgreSQL 18 + Prisma ORM 6
- **Auth** : JWT (jsonwebtoken) + bcryptjs
- **QR codes** : `qrcode` (PNG)
- **Import** : `multer` (upload) + `xlsx` (parse .csv et .xlsx)
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

## Principaux endpoints

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| `POST` | `/api/badgeage` | public | Badgeage : `{ "matricule" }` → infos ouvrier + pointage |
| `POST` | `/api/auth/login` | public | Connexion → token JWT |
| `POST` | `/api/auth/register` | public | Créer un compte (LECTEUR) |
| `GET` | `/api/auth/me` | authentifié | Infos du compte |
| `GET` | `/api/admins` | SUPER_ADMIN | Liste des comptes |
| `PATCH` | `/api/admins/:id/role` | SUPER_ADMIN | Changer un rôle |
| `GET` | `/api/ouvriers` | tous | Liste paginée + recherche |
| `POST` | `/api/ouvriers` | ADMIN/SUPER | Créer un ouvrier |
| `PATCH` | `/api/ouvriers/:id` | ADMIN/SUPER | Modifier |
| `PATCH` | `/api/ouvriers/:id/activer` | ADMIN/SUPER | Activer le badge |
| `PATCH` | `/api/ouvriers/:id/desactiver` | ADMIN/SUPER | Désactiver le badge |
| `DELETE` | `/api/ouvriers/:id` | ADMIN/SUPER | Supprimer (+ pointages) |
| `GET` | `/api/ouvriers/:id/badge` | tous | PNG du QR code |
| `POST` | `/api/ouvriers/import` | ADMIN/SUPER | Import massif .csv/.xlsx + QR auto |
| `GET` | `/api/pointages` | tous | Historique (filtres du/au, ouvrier, pagination) |

Le contrat détaillé (formats de requête/réponse, codes d'erreur) est dans **`docs/api-contrat.md`**.

### Import massif d'ouvriers

Le fichier (`.csv` ou `.xlsx`) doit contenir **exactement** 3 colonnes dans l'en-tête :

```csv
Nom,Prénom,Département
KEITA,Awa,Chorale
FOFANA,Ibrahim,Logistique
```

- Le **matricule** est auto-généré (`RSI-XXXX`) et le **QR badge** créé automatiquement.
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
- `PORT` (défaut 3000)

Après déploiement : vérifier `GET /api/health`, puis lancer le seed et l'import d'ouvriers via la console du service.
