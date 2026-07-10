# Focus

Plateforme mobile-first PWA pour aider les utilisateurs à réaliser leurs objectifs avec un système de crédits et de responsabilité.

## Stack

- **Nuxt 4** — framework full-stack
- **Tailwind CSS** — design sobre inspiré Apple (Open Sans)
- **Pinia** — état client transversal
- **TanStack Vue Query** — cache et données serveur
- **Zod** — validation
- **GSAP + Lenis** — animations landing
- **PostgreSQL + Drizzle** — base de données
- **Redis + BullMQ** — files et worker échéances
- **Railway** — hébergement (web + worker + BDD + Redis)

## Fonctionnalités

- Authentification email + mot de passe (sessions HttpOnly)
- 3 types d'objectifs : ponctuel, récurrent, projet à jalons
- +10 crédits par réussite, -20 par échec (dette séparée si solde insuffisant)
- Validation par déclaration + preuve facultative + modération admin
- Classement par score net (crédits − dette)
- Panel admin complet (users, modération, crédits, audit)
- PWA installable

## Installation locale

```bash
pnpm install
cp .env.example .env
# Configurer DATABASE_URL et REDIS_URL

# Créer les tables
pnpm db:migrate

# Injecter des données factices (admin + utilisateurs démo)
pnpm db:seed

# Lancer l'app
pnpm dev

# Lancer le worker (terminal séparé)
pnpm worker
```

## Variables d'environnement

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `SESSION_SECRET` | Secret pour les sessions |
| `ADMIN_EMAIL` | Email admin |
| `ADMIN_PASSWORD` | Mot de passe initial admin |
| `APP_URL` | URL publique de l'app |

## Déploiement Railway

1. Connecter le repo GitHub à Railway
2. Ajouter les services **PostgreSQL** et **Redis**
3. Créer 2 services à partir du repo :
   - **web** : `node .output/server/index.mjs`
   - **worker** : `npx tsx server/workers/deadlines.ts`
4. Configurer les variables d'environnement
5. Exécuter la migration SQL sur PostgreSQL
6. Le seed admin s'exécute au démarrage si `ADMIN_EMAIL` + `ADMIN_PASSWORD` sont définis

## Règles métier

| Action | Crédits |
|--------|---------|
| Réussite | +10 |
| Échec | -20 (dette si solde < 20) |
| Inscription | +50 bonus |

Les futurs gains remboursent d'abord la dette avant d'alimenter le solde.

## Tests

```bash
pnpm test
```

## Structure

```
app/           # Frontend Nuxt (pages, composants, layouts)
server/        # API Nitro, BDD, worker
tests/         # Tests unitaires
public/        # Assets statiques, icônes PWA
```
