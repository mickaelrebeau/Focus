# Contribuer à Focus

Merci de contribuer à Focus. Ce guide explique comment participer au projet open source.

## Prérequis

- Node.js 22
- pnpm 10
- PostgreSQL et Redis (locaux ou distants)

## Mise en place

```bash
git clone https://github.com/mickaelrebeau/Focus.git
cd Focus
pnpm install
cp .env.example .env
# Renseigner DATABASE_URL, REDIS_URL et SESSION_SECRET
pnpm db:migrate
pnpm dev
```

Dans un second terminal :

```bash
pnpm worker
```

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
