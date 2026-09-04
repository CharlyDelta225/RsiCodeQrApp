# Frontend — RsiCodeQrApp

Deux applications distinctes, toutes deux consommant l'API décrite dans
[`../docs/api-contrat.md`](../docs/api-contrat.md) — **seule source de vérité**
sur les endpoints, formats et codes d'erreur. En cas de doute, on se réfère à
ce document, jamais au code du backend directement.

- `dashboard/` — admin (login, gestion des ouvriers, historique). **Étape
  actuelle : scaffold + login fonctionnel (JWT).** Sidebar/topbar/KPI à venir.
- `terminal/` — kiosque plein écran pour le badgeage (pas encore commencé).

## Lancer le dashboard en local

### 1. Backend d'abord (obligatoire)

```bash
cd backend
cp .env.example .env
```

Éditer `.env` :
- `DATABASE_URL` : une base PostgreSQL locale ou distante (voir options ci-dessous)
- `JWT_SECRET` : n'importe quelle chaîne longue en dev (ex. générée avec
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` : le compte que le script de seed va créer

**Option la plus rapide pour une base PostgreSQL locale (Docker) :**
```bash
docker run --name rsi-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
```
puis `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rsi_code_qr_dev?schema=public"`

Ensuite :
```bash
npm install
npx prisma migrate dev      # applique la migration déjà présente dans prisma/migrations/
npm run seed                # crée les ouvriers d'exemple + l'admin depuis .env
npm run dev                 # démarre sur http://localhost:3000
```

> ⚠️ Les scripts `prisma:migrate` / `prisma:generate` / `prisma:deploy` du
> `package.json` du backend utilisent `set VAR=...` (syntaxe Windows/cmd).
> Sur macOS/Linux, ça échoue avec `set: command not found`. Utilise
> directement `npx prisma migrate dev` comme ci-dessus (le `PRISMA_ENGINES_MIRROR`
> n'est utile que si le téléchargement des engines Prisma est bloqué — pas le
> cas par défaut). À signaler à ton frère si vous voulez que ça marche sur
> les deux OS sans y penser.

Vérifie que ça tourne : `curl http://localhost:3000/api/health` → `{"status":"ok",...}`

### 2. Dashboard

Dans un second terminal :

```bash
cd frontend/dashboard
npm install
npm run dev                 # démarre sur http://localhost:5174
```

Ouvre `http://localhost:5174` → tu dois arriver sur `/login`. Connecte-toi
avec `ADMIN_EMAIL` / `ADMIN_PASSWORD` (ceux du `.env` backend, utilisés par
le seed). Si ça fonctionne, tu es redirigé sur `/` et tu vois "Connexion
réussie" avec ton email — ça confirme que le login → JWT → route protégée
(`/api/auth/me`) fonctionne de bout en bout.

Le proxy Vite (`vite.config.js`) redirige automatiquement `/api/...` vers
`http://localhost:3000` en dev — pas besoin de configurer `VITE_API_URL` en
local. Il ne sert qu'en production (Vercel → URL Railway/Render).

## Ce qui est fait / pas fait (étape 1)

- ✅ Scaffold Vite + React + Tailwind v4 (même base que ce qu'on utilisera
  pour l'identité visuelle à l'étape 2)
- ✅ Client API (`src/lib/api.js`) conforme au contrat : gère `{ok, code,
  message}`, ajoute le `Authorization: Bearer` automatiquement, et force la
  déconnexion sur un 401
- ✅ Login (`/login`) + route protégée (`/`)
- ⬜ Sidebar / topbar / cartes KPI (identité visuelle) — étape 2
- ⬜ Page Ouvriers (liste, création, désactivation, badge PNG) — étape 3
- ⬜ Page Pointages / historique — étape 5

## Convention de contribution

- Une branche par lot de travail (`frontend/dashboard-shell`,
  `frontend/ouvriers-page`, ...), jamais de push direct sur `main`.
- On ne modifie jamais `backend/`. Un besoin d'endpoint manquant ou un
  comportement à clarifier se discute avec l'auteur du backend et se
  documente dans `docs/api-contrat.md` (journal des changements), pas par une
  modif directe.
