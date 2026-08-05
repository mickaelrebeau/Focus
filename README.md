# Focus

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-22-brightgreen.svg)](./package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

PWA open source, mobile-first, pour aider à réaliser ses objectifs avec un système de crédits, de conséquences et de responsabilité.

## Stack

- **Nuxt 4** — framework full-stack
- **Tailwind CSS** — design system app + landing
- **Pinia** — état client transversal
- **TanStack Vue Query** — cache et données serveur
- **Zod** — validation
- **GSAP + Lenis** — animations landing
- **PostgreSQL + Drizzle** — base de données
- **Redis + BullMQ** — files et workers
- **Stripe** — paiements liés aux conséquences (optionnel)
- **Railway** — hébergement (web + workers + BDD + Redis)

## Fonctionnalités

- Authentification email + mot de passe (sessions HttpOnly) et Google OAuth
- 3 types d’objectifs : ponctuel, récurrent, projet à jalons
- Crédits / dette, streak, classement
- Conséquences configurables (crédits, don associatif, Stripe, preuve obligatoire, etc.)
- Validation par déclaration + preuve + modération admin
- Panel admin (users, modération, cagnottes, audit)
- PWA installable

## Installation locale

```bash
pnpm install
cp .env.example .env
# Configurer DATABASE_URL, REDIS_URL et SESSION_SECRET

pnpm db:migrate
pnpm db:seed          # optionnel : données de démo
pnpm dev              # app
pnpm worker           # échéances (terminal séparé)
pnpm worker:consequences  # file des conséquences (si besoin)
```

## Variables d’environnement

Voir [`.env.example`](./.env.example). Ne committez jamais de fichier `.env` réel.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL |
| `REDIS_URL` | Redis |
| `SESSION_SECRET` | Secret des sessions |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Compte admin initial |
| `APP_URL` | URL publique |
| `GOOGLE_CLIENT_*` | OAuth Google (optionnel) |
| `STRIPE_*` | Paiements Stripe (optionnel) |
| `S3_*` | Stockage des preuves (optionnel) |

## Scripts utiles

| Commande | Rôle |
|----------|------|
| `pnpm dev` | Serveur de développement |
| `pnpm test` | Tests unitaires |
| `pnpm lint` | Typecheck Nuxt |
| `pnpm build:web` | Build production |
| `pnpm worker` | Worker d’expiration / streaks |
| `pnpm worker:consequences` | Worker d’exécution des conséquences |

## Déploiement Railway

1. Connecter le repo GitHub à Railway
2. Ajouter PostgreSQL et Redis
3. Créer les services à partir du repo :
   - **web** : `node .output/server/index.mjs`
   - **worker** : `npx tsx server/workers/deadlines.ts`
   - **worker:consequences** (optionnel) : `npx tsx server/workers/consequences.ts`
4. Configurer les variables d’environnement
5. Exécuter les migrations SQL
6. Le seed admin s’exécute au démarrage si `ADMIN_EMAIL` + `ADMIN_PASSWORD` sont définis

## Contribuer

Les contributions sont les bienvenues.

- [Guide de contribution](./CONTRIBUTING.md)
- [Code de conduite](./CODE_OF_CONDUCT.md)
- [Politique de sécurité](./SECURITY.md)

## Licence

Focus est publié sous licence [MIT](./LICENSE).

Vous êtes libre d’utiliser, modifier, forker et redistribuer le projet, y compris à des fins commerciales, sous réserve d’inclure la notice de copyright et la licence.
