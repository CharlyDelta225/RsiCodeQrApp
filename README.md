# RsiCodeQrApp — Badgeage QR pour ouvriers d'église

Système de **badgeage par QR code** : chaque ouvrier reçoit un badge avec un QR code ; une douchette scanne le QR au kiosque (terminal), le matricule est envoyé à l'API qui enregistre le pointage et renvoie les infos de l'ouvrier. Un dashboard permet à l'équipe de gérer les ouvriers, les départements et de consulter l'historique.

**Monorepo** : backend API + dashboard + terminal, tous maintenus ici.

```
RsiCodeQrApp/
├── api/                    ← entrée serverless Vercel (réexporte l'app Express)
├── backend/                ← API Node.js/Express + PostgreSQL/Prisma
│   ├── src/                ← code applicatif
│   │   ├── routes/         ← endpoints (badgeage, auth, ouvriers, pointages, admins, import, départements, rapports)
│   │   ├── middleware/     ← requireAuth + requireRole
│   │   ├── lib/            ← prisma client, générateur de matricule, ipReelle (rate-limit)
│   │   └── scripts/        ← seed, set-admin (SUPER_ADMIN), check-admin
│   ├── prisma/             ← schéma + migrations
│   ├── tests/              ← tests d'intégration (node:test)
│   ├── data/               ← exemple de fichier CSV
│   └── public/             ← assemblage dashboard/ + terminal/ (produit par le build Vercel, non commité)
├── frontend/dashboard/     ← gestion + historique (Vite + React + Tailwind)
│   └── src/ui/             ← composants UI réutilisables (TableShell, Btn, Pill, inputs…)
├── frontend/terminal/      ← kiosque de badgeage (caméra + annonces vocales)
│   └── audio/              ← sons et annonces vocales (WAV)
├── scripts/                ← vercel-build.mjs (pipeline de build Vercel)
├── vercel.json             ← config déploiement Vercel (serverless)
└── docs/api-contrat.md     ← contrat d'API partagé (endpoints, formats, codes d'erreur)
```

---

## Technologies

- **Backend** : Node.js (ESM) + Express 5
- **Base de données** : PostgreSQL — **base commune Supabase** (session pooler) pour toute l'équipe ; fallback local PostgreSQL 18 — + Prisma ORM 6
- **Auth** : JWT (jsonwebtoken) + bcryptjs + `express-rate-limit` (anti brute-force)
- **QR codes** : `qrcode` (PNG) + `archiver` (ZIP bulk)
- **Import** : `multer` (upload) + `xlsx` (parse .csv et .xlsx)
- **Rapports** : `pdfkit` (PDF par département + récap), `nodemailer` (envoi email SMTP), `node-cron` (envoi auto 06h00)
- **Sécurité** : CORS restreint, limites de corps/fichier, rôles (moindre privilège)
- **Déploiement** : **Vercel** (serverless — entrée `api/index.js`, build `scripts/vercel-build.mjs` ; migrations appliquées manuellement via le pooler Supabase)

---

## Base de données commune — Supabase (équipe)

Pour **uniformiser les tests**, tout le monde pointe sur la **même base Supabase**
(hébergée), pas sur des bases locales séparées.

- **Connexion** : via le **Session pooler** (IPv4, accessible sur tous les réseaux).
  Dans le dashboard Supabase : **Connect → "Session pooler"** → copier l'URI.
- **Format** :
  `postgresql://postgres.<REF-PROJET>:<MOT-DE-PASSE>@aws-1-<REGION>.pooler.supabase.com:5432/postgres?schema=public&connection_limit=4&sslmode=require`
  Le mot de passe reste **privé** : il se partage hors du dépôt (jamais commiter).
- ⚠️ Éviter "**Direct connection**" (`db.<ref>.supabase.co`) : **IPv6 uniquement**.
- **Schéma déjà appliqué + données d'exemple présentes** : après `cp .env.example .env`
  et mise du bon `DATABASE_URL`, un simple `npm start` suffit — pas de migration.
- **Nouvelle table / modèle** ? Modifier `prisma/schema.prisma` puis
  `npm run prisma:migrate` → la migration s'applique **sur Supabase** (la base
  locale n'est plus utilisée sauf à re-pointer `DATABASE_URL` dessus).
- **Réinitialiser des données d'exemple** : `npm run seed` (idempotent : départements,
  ouvriers d'exemple, admin `SUPER_ADMIN`).

---

## Installation et lancement (développement local)

Prérequis : Node.js 18+, PostgreSQL en cours d'exécution.

```bash
# 1. Installer les dépendances du backend
cd backend
npm install

# 2. Configurer les variables d'environnement
cp .env.example .env   # remplir DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
                        #   (équipe : DATABASE_URL = pooler Supabase, voir section ci-dessus)

# 3. Appliquer le schéma de base de données
npm run prisma:migrate  # requis uniquement si la base n'est pas provisionnée
                        # (base commune Supabase : déjà appliqué → passer à l'étape 4)

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

| Route | Contenu | Accès |
|---|---|---|
| `/` | Tableau de bord : KPIs, pointages récents | tous |
| `/ouvriers` | Gestion des ouvriers (CRUD, import `.csv`/`.xlsx`) | lecture : tous · écriture : ADMIN/SUPER |
| `/badges` | Badges QR (aperçu) | tous · export/impression : ADMIN/SUPER |
| `/pointages` · `/historique` | Pointages du jour · historique filtrable | lecture : tous · export CSV : ADMIN/SUPER |
| `/departements` | Membres et postes par département | lecture : tous · export CSV : ADMIN/SUPER |
| `/gestion-departements` | Créer / lister / renommer / exporter les départements | ADMIN/SUPER |
| `/rapports` | Rapport de pointage : filtrer (date/département), présent/absent, envoyer par email | lecture : tous · CSV/email : ADMIN/SUPER |
| `/gestion-admins` | Créer / rôles / activer-désactiver / débloquer / réinit mdp / supprimer les comptes | SUPER_ADMIN |

Pages publiques (hors authentification) :

| Route | Contenu |
|---|---|
| `/login` | Connexion (avec compteur de tentatives et lien « mot de passe oublié ») |
| `/inscription` | Créer un compte — le compte naît **LECTEUR** (moindre privilège) |
| `/oublie` | Demander un lien de réinitialisation de mot de passe (envoyé par email) |
| `/reinitialisation` | Poser un nouveau mot de passe grâce au lien reçu (usage unique, 1 h) |

> Les listes du dashboard sont **paginées à 17 éléments par page** ; la
> suppression d'un département et la déconnexion passent par un popup de
> confirmation. Un LECTEUR ne voit que des boutons de consultation : toute
> extraction (import, export CSV/PDF, ZIP des badges) est réservée aux rôles
> à écriture, côté interface **et** côté API.

### Terminal kiosque

Le terminal est servi directement par le backend : dev `http://localhost:3000/terminal`, prod `https://<app>/terminal`.

- Scan du QR badge par **caméra** (html5-qrcode) ; le matricule est envoyé à `POST /api/badgeage`.
- **Sons + annonces vocales** (WAV dans `frontend/terminal/audio/`) selon le résultat : succès, déjà badgé, erreur, avec annonce du prénom.
- **Politique d'autoplay** : un scan caméra n'est **pas** compté comme geste utilisateur par le navigateur (et iOS/tablettes sont stricts). Le terminal demande **un seul contact** au premier affichage (bandeau « Touchez l'écran pour activer le son »), qui démarre l'`AudioContext` Web Audio de façon **persistante** → chaque badge suivant joue sa voix **automatiquement**, sans retoucher l'écran. Bouton 🔊/🔇 en haut à droite.

> Sur Windows, npm 11 bloque les scripts d'installation des moteurs Prisma : la config `allowScripts` dans `backend/package.json` règle ce point. Le miroir `registry.npmmirror.com` dans `.npmrc` facilite l'install si le réseau est instable.

---

## Rôles et permissions

| Rôle | Lire ouvriers/pointages | Écrire ouvriers / import | Gérer départements | Exports (CSV/ZIP/PDF) | Gérer les comptes |
|---|---|---|---|---|---|
| `LECTEUR` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `ADMIN` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `SUPER_ADMIN` | ✅ | ✅ | ✅ | ✅ | ✅ |

- **Inscription** (`POST /api/auth/register`) est **publique** (page `/inscription`) : tout compte naît `LECTEUR`, aucun droit d'extraction.
- **Élévation de rôle** : un `SUPER_ADMIN` change le rôle via `PATCH /api/admins/:id/role` depuis le dashboard (`/gestion-admins`).
- **Création de compte par le SUPER_ADMIN** : le mot de passe est généré et **envoyé par email** (s'il est renvoyé dans la réponse, l'email a échoué).
- **Anti-verrouillage** : un `SUPER_ADMIN` ne peut ni modifier son propre rôle, ni se désactiver, ni se supprimer (et le dernier `SUPER_ADMIN` ne peut pas être supprimé).

---

## Sécurité

| Protection | Détail |
|---|---|
| **Anti brute-force** | `login` / `register` / `reset-demand` limités à **10 tentatives/min par IP réelle** → `429 TROP_DE_TENTATIVES` ; badgeage limité à 30/min |
| **IP réelle** | les rate-limits utilisent l'IP du client **derrière le proxy** (`X-Vercel-Forwarded-For`) — `X-Forwarded-For` (forgeable) n'est jamais une clé de limite (`src/lib/ip.js`) ; maximum surchargeable via `AUTH_RATE_LIMIT_MAX` |
| **Blocage par compte** | **3 mots de passe erronés** → compte gelé **15 min** (`423 COMPTE_BLOQUE`, minutes restantes dans `reste`) ; déblocage manuel par le SUPER_ADMIN |
| **Anti-énumération** | `register` et `reset-demand` renvoient des réponses **strictement identiques** quelle que soit l'existence de l'email — aucun oracle (`emailEnvoye` neutre) |
| **Récupération de mot de passe** | lien unique envoyé par email (**usage unique, 1 h**), stocké **haché** (SHA-256) en base, jamais en clair |
| **Anti double-badgeage** | règle « une fois par jour civil » verrouillée **en base** (`jour` Date + index unique `(ouvrierId, jour)`) → atomique même en concurrence |
| **CORS restreint** | seules origines dashboard (dev 5173/5174) + même origine acceptée (terminal) ; autre → `403 ORIGINE_NON_AUTORISEE` |
| **Corps JSON limité** | 100 ko max → `413 CORPS_TROP_GROS` |
| **Import borné** | fichier ≤ 5 Mo (`413 FICHIER_TROP_GROS`) et ≤ 2000 lignes (`400 TROP_DE_LIGNES`) |
| **Matricule unique** | génération avec **retry** sur collision `P2002` (2 requêtes simultanées ne produisent plus `409 MATRICULE_EXISTANT` pour un matricule auto) |
| **Réponses d'erreur** | jamais de stack technique ; code machine `{ ok, code, message }` |
| **Moindre privilège** | rôle `LECTEUR` par défaut à l'inscription, écritures et extractions réservées `ADMIN`/`SUPER_ADMIN` |

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

## Modèle de données — Pointages (anti double-badgeage)

Un ouvrier ne peut badger **qu'une fois par jour civil** :

```
Pointage { id, ouvrierId, dateHeure (timestamp), jour (Date), type }
UNIQUE (ouvrierId, jour)   → migration 20260912090000_anti_double_badgeage
```

- La colonne `jour` (date du badge, heure UTC) + l'index unique **garantissent la règle en base** : deux requêtes simultanées, une seule crée le pointage, l'autre reçoit `P2002` → `409 DEJA_BADGE_AUJOURDHUI`.
- Index croisé `(ouvrierId, jour)` : l'unicité par ouvrier et par jour, sans ralentir les recherches par jour.

---

## Principaux endpoints

### Badgeage (public)

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/api/badgeage` | Badgeage : `{ "matricule" }` → infos ouvrier + pointage. **Un seul badgeage par jour civil**, verrouillé en base (colonne `jour` + index unique `(ouvrierId, jour)`) : même deux requêtes simultanées, une seule aboutit, l'autre reçoit `409 DEJA_BADGE_AUJOURDHUI` (heure UTC) |

### Authentification

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | public | Connexion → token JWT (rate-limit par IP + blocage après 3 échecs) |
| `POST` | `/api/auth/register` | public | Créer un compte (LECTEUR) — réponse identique email déjà pris/succès (anti-énumération) |
| `POST` | `/api/auth/reset-demand` | public | Envoyer un lien de réinitialisation par email — réponse identique email connu/inconnu (anti-énumération) |
| `POST` | `/api/auth/reset` | public | Poser un nouveau mot de passe (lien unique, 1 h) |
| `GET` | `/api/auth/me` | authentifié | Infos du compte |

### Admins (SUPER_ADMIN)

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/admins` | Liste des comptes (avec statut `actif` et blocage) |
| `POST` | `/api/admins` | Créer un compte (mot de passe généré + envoyé par email) |
| `PATCH` | `/api/admins/:id/role` | Changer un rôle |
| `PATCH` | `/api/admins/:id/activer` | Réactiver un compte |
| `PATCH` | `/api/admins/:id/desactiver` | Désactiver un compte |
| `PATCH` | `/api/admins/:id/debloquer` | Déverrouiller un compte gelé (3 échecs) |
| `POST` | `/api/admins/:id/reinitialiser-mot-de-passe` | Nouveau mot de passe temporaire (envoyé par email) |
| `DELETE` | `/api/admins/:id` | Supprimer un compte |

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
| `GET` | `/api/ouvriers/badges/zip` | ADMIN/SUPER | ZIP de tous les badges QR (extraction) |
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

### Rapports

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| `GET` | `/api/rapports/journalier` | tous | Structure d'un rapport (filtres `date`, `departementId`) pour la page `/rapports` |
| `POST` | `/api/rapports/journalier` | ADMIN/SUPER | Génère les PDF par département + récap et les envoie par email (destinataires ou `RAPPORT_EMAIL_DESTINATAIRES`) |

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

## Déploiement (Vercel — serverless)

L'API Express **et** le dashboard **et** le terminal sont servis sous une seule
URL Vercel (ex. `https://rsi-app-phi.vercel.app`).

- **Entrée** : `api/index.js` → réexporte l'app Express (`backend/src/app.js`).
- **Config** : `vercel.json` — `functions.api/index.js.maxDuration=60`,
  `includeFiles=backend/public/**` (les assets servis par Express sont empaquetés
  avec la fonction), rewrite `/(.*)` → `/api/index`, `outputDirectory=backend/public`.
- **Build** : `scripts/vercel-build.mjs` :
  1. `npm install` (backend + dashboard, registre npmjs) puis `npx prisma generate`,
  2. `vite build` du dashboard (`VITE_API_URL` vide → mêmes-origine `/api/...`),
  3. assemble `frontend/dashboard/dist` → `backend/public/dashboard` et
     `frontend/terminal/` → `backend/public/terminal`.
- **Migrations** : **non** appliquées au déploiement (instance immuable). Elles
  s'appliquent à la main via le pooler Supabase : `npx prisma migrate deploy`
  (ou en direct, cf. section base commune).

Déploiement en CLI (depuis la racine du dépôt) :

```bash
npx vercel --prod --scope solutionniste --yes
```

Variables d'environnement (à renseigner dans le projet Vercel / le `.env`) :
- `DATABASE_URL` — pooler Supabase (`postgresql://postgres.<ref>:<mdp>@aws-1-<region>.pooler.supabase.com:5432/postgres?schema=public`) ; sans `sslmode` dans l'URL, le code passe `ssl: { rejectUnauthorized: false }`
- `JWT_SECRET` (secret aléatoire)
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_EXPEDITEUR` (rapports + création de comptes + liens de réinitialisation)
- `APP_URL` (URL du dashboard, ex. `https://rsi-app-phi.vercel.app` — liens de réinitialisation)
- `CORS_ORIGINES` (origines du dashboard, ex. `https://rsi-app-phi.vercel.app`)
- `AUTH_RATE_LIMIT_MAX` (optionnel, défaut 10/min par IP sur l'authentification)
- `RAPPORT_EMAIL_DESTINATAIRES` (destinataires par défaut des rapports, séparés par des virgules)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` (création/rotation du compte SUPER_ADMIN via `npm --prefix backend run seed` ou `node backend/src/scripts/set-admin.js`)

Comptes : création d'un SUPER_ADMIN idempotente (`set-admin.js`, upsert d'après
`ADMIN_EMAIL`/`ADMIN_PASSWORD`), contrôle du hash avec `check-admin.mjs`.

Après déploiement : vérifier `GET /api/health`, puis ouvrir `/` (dashboard),
`/terminal` (kiosque) et `/login`.
