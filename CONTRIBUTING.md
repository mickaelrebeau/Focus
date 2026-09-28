# Contribuer à Focus

Merci de contribuer à Focus. Ce guide explique comment participer au projet open source.

## Prérequis

- Node.js 22
- pnpm 10
- PostgreSQL et Redis : via Docker Compose (recommandé) ou installés localement / distants

## Mise en place

```bash
git clone https://github.com/mickaelrebeau/Focus.git
cd Focus
docker compose up -d   # PostgreSQL + Redis (optionnel si déjà installés)
pnpm install
cp .env.example .env
# Valeurs par défaut alignées avec Docker Compose ; renseigner SESSION_SECRET
pnpm db:migrate
pnpm dev
```

Dans un second terminal :

```bash
pnpm worker
```

Avant de toucher aux échéances, au streak ou aux conséquences, lisez [docs/architecture.md](./docs/architecture.md).

## Avant d’ouvrir une PR

1. Créer une branche depuis `main`
2. Faire des commits ciblés et lisibles
3. Lancer les vérifications :

```bash
pnpm test
pnpm lint
pnpm build:web
```

4. Décrire le problème résolu, les changements et le plan de test

La CI GitHub Actions relance `pnpm test`, `pnpm lint` et les tests E2E sur chaque PR : elle doit être verte pour merger.

## Tests E2E

Un parcours Playwright (`e2e/`) couvre le chemin critique : inscription, onboarding, création d’objectif, validation d’une échéance, agenda (échéance réussie et échéance expirée passée en échec), connexion.

```bash
docker compose up -d                  # PostgreSQL + Redis
pnpm exec playwright install chromium # une seule fois
pnpm test:e2e
```

`pnpm test:e2e` crée la base `focus_e2e` si besoin, applique les migrations, build l’app puis la lance sur le port 3100.

- **Les E2E n’utilisent jamais votre `.env`**, qui peut pointer vers une base distante. La base et Redis se règlent avec `E2E_DATABASE_URL` (défaut `postgresql://postgres@localhost:5432/focus_e2e`) et `E2E_REDIS_URL` (défaut `redis://localhost:6379/15`). Un hôte autre que `localhost` est refusé, sauf avec `E2E_ALLOW_REMOTE=1`.
- Si le port 5432 est déjà pris : `POSTGRES_PORT=55432 docker compose up -d`, puis `E2E_DATABASE_URL=postgresql://postgres@localhost:55432/focus_e2e pnpm test:e2e`.
- En cas d’échec, `pnpm exec playwright show-report` ouvre le rapport avec les traces et captures. En CI, le rapport est publié en artefact.

## Conventions

- **Langue** : issues, PR et commits de préférence en français (l’anglais est accepté)
- **Périmètre** : une PR = un sujet (bug, feature ou docs)
- **Secrets** : ne jamais committer `.env`, clés API, tokens ou données personnelles
- **UI** : l’espace connecté utilise les tokens `app-*` ; landing/auth/admin utilisent `focus-*`
- **Tests** : ajouter ou mettre à jour des tests unitaires pour toute logique métier non triviale

## Signaler un bug

Ouvrir une [issue](https://github.com/mickaelrebeau/Focus/issues) avec :

- les étapes de reproduction
- le comportement attendu / observé
- l’environnement (OS, navigateur, Node)

## Proposer une idée

Ouvrir une issue « feature » avant d’implémenter une grosse fonctionnalité, pour valider le besoin et l’approche.

## Licence

En contribuant, vous acceptez que vos contributions soient publiées sous la [licence MIT](./LICENSE).
