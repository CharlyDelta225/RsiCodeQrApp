# Frontend — RsiCodeQrApp

Deux applications, toutes deux maintenues ici (plus « équipe front » séparée) :

- `dashboard/` — application d'administration : login, ouvriers, badges QR,
  pointages, départements (membres et postes), rapports, gestion des comptes.
- `terminal/` — kiosque plein écran de badgeage par caméra avec annonces vocales.

Elles consomment l'API décrite dans
[`../docs/api-contrat.md`](../docs/api-contrat.md) — **seule source de vérité**
sur les endpoints, formats et codes d'erreur. En cas de doute, on se réfère à
ce document, jamais au code du backend directement.

---

## Lancer le dashboard en local

### 1. Backend d'abord (obligatoire)

```bash
cd backend
cp .env.example .env
```

Éditer `.env` :
- `DATABASE_URL` : base PostgreSQL (locale, ou pooler Supabase partagé)
- `JWT_SECRET` : chaîne longue (ex. générée avec
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` : compte SUPER_ADMIN du seed

Base PostgreSQL locale rapide (Docker) :
```bash
docker run --name rsi-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
```
puis `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rsi_code_qr_dev?schema=public"`

Puis :
```bash
npm install
npx prisma migrate dev      # applique les migrations de prisma/migrations/
npm run seed                # ouvriers d'exemple + admin depuis .env
npm run dev                 # http://localhost:3000
```

> ⚠️ Les scripts `prisma:migrate` / `prisma:generate` / `prisma:deploy` du
> `package.json` du backend utilisent la syntaxe `set VAR=...` (Windows/cmd).
> Sur macOS/Linux, utiliser directement `npx prisma migrate dev`.

Vérifier : `curl http://localhost:3000/api/health` → `{"status":"ok",...}`

### 2. Dashboard

```bash
cd frontend/dashboard
npm install
npm run dev                 # http://localhost:5174
```

Ouvre `http://localhost:5174` → `/login`. Le proxy Vite (`vite.config.js`)
redirige `/api/...` vers `http://localhost:3000` : pas besoin de configurer
`VITE_API_URL` en local (il sert uniquement si le dashboard est servi par un
autre hôte que l'API).

### 3. Terminal

Le kiosque est servi **par le backend** : `http://localhost:3000/terminal`.
Il se teste indépendamment (aucun build requis en dev).

---

## Pages du dashboard

| Route | Contenu | Accès |
|---|---|---|
| `/login` · `/inscription` · `/oublie` · `/reinitialisation` | Auth publique | public |
| `/` | Tableau de bord : KPIs, pointages récents | tous |
| `/ouvriers` | CRUD ouvriers, import `.csv`/`.xlsx`, activer/désactiver le badge | lecture : tous · écriture : ADMIN/SUPER |
| `/badges` | Badges QR (aperçu, ZIP) | tous · export : ADMIN/SUPER |
| `/pointages` · `/historique` | Pointages du jour · historique filtrable | lecture : tous · export CSV : ADMIN/SUPER |
| `/departements` | Membres et postes par département (**postes : voir ci-dessous**) | lecture : tous · écriture : ADMIN/SUPER |
| `/gestion-departements` | Créer / lister / renommer / exporter les départements | ADMIN/SUPER |
| `/rapports` | Rapport du jour/département, présent/absent, envoi email | lecture : tous · CSV/email : ADMIN/SUPER |
| `/gestion-admins` | Comptes admin : rôles, activation, déblocage, réinit, suppression | SUPER_ADMIN |

### Postes dans les départements

Chaque ouvrier a **un poste par département** (`roleDansDepartement`) :
`RESPONSABLE`, `ADJOINT`, `SECRETAIRE`, `MEMBRE` (défaut). La popup d'édition
d'un membre (bouton ⚙) permet de changer nom/prénom, l'**activation du badge**
et le **poste** (avec contrainte : un seul RESPONSABLE et un seul ADJOINT par
département, `409 POSTE_DEJA_PRIS`).

---

## Sons du terminal (politique d'autoplay)

Le terminal joue une tonalité + une **annonce vocale** (WAV) à chaque badge.
Les navigateurs bloquent l'audio tant que l'utilisateur n'a pas interagi avec
la page — et un **scan caméra n'est pas une interaction**. Comportement
attendu :

- Au premier affichage, un bandeau « Touchez l'écran pour activer le son »
  apparaît si le navigateur bloque la lecture.
- **Un seul contact suffit** : il démarre l'`AudioContext` Web Audio
  (persistant) ; **chaque badge suivant joue son annonce automatiquement**,
  sans retoucher l'écran.
- Bouton 🔊/🔇 (en haut à droite) pour couper/réactiver le son
  (mémorisé dans `localStorage`).

> Les fichiers sont dans `frontend/terminal/audio/`. Le build Vercel les copie
> dans `backend/public/terminal/audio/`. Si le son ne change pas après une mise
> à jour, vider le cache du navigateur (Ctrl+F5).