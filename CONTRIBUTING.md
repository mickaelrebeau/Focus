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

Un parcours Playwright (`e2e/`) couvre le chemin critique : inscription, onboarding, création d’objectif, validation d’une échéance, agenda (échéance réussie et échéance expirée passée en échec), connexion, et le mode hors ligne de la PWA (`e2e/offline.spec.ts`, service worker actif).

```bash
docker compose up -d                  # PostgreSQL + Redis
pnpm exec playwright install chromium # une seule fois
pnpm test:e2e
```

`pnpm test:e2e` crée la base `focus_e2e` si besoin, applique les migrations, build l’app puis la lance sur le port 3100.

- **Les E2E n’utilisent jamais votre `.env`**, qui peut pointer vers une base distante. La base et Redis se règlent avec `E2E_DATABASE_URL` (défaut `postgresql://postgres@localhost:5432/focus_e2e`) et `E2E_REDIS_URL` (défaut `redis://localhost:6379/15`). Un hôte autre que `localhost` est refusé, sauf avec `E2E_ALLOW_REMOTE=1`.
- Si le port 5432 est déjà pris : `POSTGRES_PORT=55432 docker compose up -d`, puis `E2E_DATABASE_URL=postgresql://postgres@localhost:55432/focus_e2e pnpm test:e2e`.
- En cas d’échec, `pnpm exec playwright show-report` ouvre le rapport avec les traces et captures. En CI, le rapport est publié en artefact.

## Traductions (i18n)

L’interface utilise [`@nuxtjs/i18n`](https://i18n.nuxtjs.org). Le **français est la langue par défaut** et la langue de référence ; l’anglais est disponible via le sélecteur FR / EN (en-tête public, menu de l’espace connecté). Le choix est mémorisé dans le cookie `focus_locale`. Il n’y a pas de détection automatique de la langue du navigateur tant que toute l’interface n’est pas traduite.

Aujourd’hui, les parcours traduits sont l’authentification, l’agenda, la validation d’une échéance, les conséquences et la navigation. Le reste de l’app est encore en français uniquement : toute PR qui étend la couverture est bienvenue.

### Traduire un texte

1. Ajouter la clé dans `i18n/locales/fr.json` **et** `i18n/locales/en.json`, sous la section de l’écran concerné (`auth`, `agenda`, `consequences`…).
2. Dans le composant : `const { t } = useI18n()`, puis `{{ t('agenda.title') }}` dans le template ou `:label="t('…')"` pour un attribut.
3. Paramètres : `"Priorité {n}"` → `t('consequences.priority', { n: 2 })`. Pluriel : `"{count} crédit | {count} crédit | {count} crédits"` (zéro | un | plusieurs) → `t('common.credits', 3)`.
4. Caractères réservés par vue-i18n : écrire `{'@'}` pour un `@` (ex. `vous{'@'}email.com`), et de même pour `{`, `}`, `|` et `$`.
5. Dates : utiliser `dateLocale` de `useLanguage()` avec date-fns, ou `localeProperties.language` avec `Intl` / `toLocaleDateString`.

Les textes produits par le serveur (erreurs d’API, noms et estimations des conséquences) restent en français. Côté client, ils sont traduits par code HTTP (`useAuthErrorMessage`) ou par clé de type (`useConsequenceText`, sections `consequences.types` et `consequences.estimates`), avec le texte du serveur en repli.

### Ajouter une langue

1. Copier `i18n/locales/en.json` vers `i18n/locales/<code>.json` et traduire toutes les valeurs, sans toucher aux clés.
2. Déclarer la langue dans `nuxt.config.ts` (`i18n.locales`) : `{ code: 'de', language: 'de-DE', name: 'Deutsch', file: 'de.json' }`.
3. Ajouter le code à `SUPPORTED_LOCALES` et la locale date-fns correspondante à `DATE_FNS_LOCALES` dans `app/utils/locale.ts`.
4. Adapter `agenda.dayFormat` au format de date usuel de la langue ([motifs date-fns](https://date-fns.org/docs/format)).
5. Vérifier les écrans traduits, en mobile comme en desktop, et lancer `pnpm lint` et `pnpm test:e2e`.

## Ajouter un modèle d’objectif

Les modèles proposés dans « Nouvel objectif » (et les packs d’habitudes) sont décrits dans [`shared/goal-templates.json`](./shared/goal-templates.json) : **aucune modification d’interface n’est nécessaire**.

1. Ajouter une entrée dans `templates` : `id` (minuscules et tirets), `icon`, `recurrence` (`daily`, `weekly_days` avec `daysOfWeek` de 0 = dimanche à 6, ou `weekly_count` avec `timesPerWeek`), `dueTime` (`HH:MM`), `suggestedConsequence` (facultatif) et `locales` (`fr` obligatoire : `title`, `description`, `category` ; autres langues facultatives).
2. Pour un pack, ajouter une entrée dans `packs` avec les `templateIds` concernés.
3. `pnpm test` valide le fichier : format, identifiants uniques, packs cohérents, et chaque modèle doit produire un objectif accepté par l’API.

**Icônes** : uniquement des icônes gratuites [Hugeicons](https://hugeicons.com), désignées par leur nom d’export (`Book02Icon`…). Pour en utiliser une nouvelle, ajoutez son nom à `TEMPLATE_ICON_NAMES` (`shared/goal-templates.ts`) et à `app/utils/template-icons.ts`. Un test vérifie que l’icône existe dans `@hugeicons/core-free-icons` et que les deux listes concordent.

## Conventions

- **Langue** : issues, PR et commits de préférence en français (l’anglais est accepté)
- **Périmètre** : une PR = un sujet (bug, feature ou docs)
- **Secrets** : ne jamais committer `.env`, clés API, tokens ou données personnelles
- **UI** : l’espace connecté utilise les tokens `app-*` ; landing/auth/admin utilisent `focus-*`
- **Tests** : ajouter ou mettre à jour des tests unitaires pour toute logique métier non triviale

## Où poser quoi ?

| Besoin | Où |
|---|---|
| Question sur l’installation, la configuration ou l’usage | [Discussions → Q&A](https://github.com/mickaelrebeau/Focus/discussions/categories/q-a) |
| Idée encore floue, envie d’en débattre | [Discussions → Ideas](https://github.com/mickaelrebeau/Focus/discussions/categories/ideas) |
| Bug reproductible | [Issue « Bug »](https://github.com/mickaelrebeau/Focus/issues/new/choose) |
| Fonctionnalité précise, prête à être implémentée | [Issue « Idée / Feature »](https://github.com/mickaelrebeau/Focus/issues/new/choose) |
| Vulnérabilité | [Advisory privé](https://github.com/mickaelrebeau/Focus/security/advisories/new), voir [SECURITY.md](./SECURITY.md) |

Les annonces du projet (versions, changements importants) sont publiées dans [Discussions → Announcements](https://github.com/mickaelrebeau/Focus/discussions/categories/announcements).

## Signaler un bug

Ouvrir une [issue](https://github.com/mickaelrebeau/Focus/issues) avec :

- les étapes de reproduction
- le comportement attendu / observé
- l’environnement (OS, navigateur, Node)

## Proposer une idée

Pour une idée encore floue, commencez par une discussion dans [Ideas](https://github.com/mickaelrebeau/Focus/discussions/categories/ideas). Une fois le besoin clarifié, ouvrez une issue « feature » avant d’implémenter une grosse fonctionnalité, pour valider l’approche.

## Licence

En contribuant, vous acceptez que vos contributions soient publiées sous la [licence MIT](./LICENSE).
