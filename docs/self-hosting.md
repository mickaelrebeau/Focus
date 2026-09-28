# Auto-héberger Focus

Ce guide liste, étape par étape, ce qu’il faut pour faire tourner votre propre instance de Focus : ce qui est obligatoire, ce qui est optionnel, et comment brancher chaque intégration (Google, S3, Stripe). Pour le fonctionnement interne, voir [architecture.md](./architecture.md).

- [Vue d’ensemble](#vue-densemble)
- [Variables : build ou runtime ?](#variables--build-ou-runtime-)
- [Checklist](#checklist)
  - [1. Services obligatoires](#1-services-obligatoires)
  - [2. Application web](#2-application-web)
  - [3. Compte administrateur](#3-compte-administrateur)
  - [4. Workers](#4-workers)
  - [5. Google OAuth (optionnel)](#5-google-oauth-optionnel)
  - [6. Stockage S3 des preuves (optionnel)](#6-stockage-s3-des-preuves-optionnel)
  - [7. Stripe (optionnel)](#7-stripe-optionnel)
  - [8. Notifications push (optionnel)](#8-notifications-push-optionnel)
  - [9. Vérifications finales](#9-vérifications-finales)
- [Référence des variables](#référence-des-variables)
- [Limites connues](#limites-connues)

## Vue d’ensemble

| Composant | Obligatoire | Rôle | Sans lui |
|---|---|---|---|
| PostgreSQL 13+ | ✅ | Données | L’app ne démarre pas |
| Redis | ✅ | Files BullMQ, verrous, limitation de débit, état OAuth | Inscription et connexion bloquées |
| Service **web** | ✅ | App Nuxt + API | — |
| Worker **deadlines** | ✅ recommandé | Expire les échéances, génère les suivantes, clôture les streaks, classement | Les échéances n’expirent que quand l’utilisateur ouvre l’app ; pas de classement hebdo |
| Worker **consequences** | ✅ recommandé | Exécute les conséquences d’un échec | Les conséquences restent « en attente » |
| Google OAuth | Optionnel | Bouton « Continuer avec Google » | Le bouton renvoie une erreur 503 |
| Bucket S3 | Optionnel | Photos de preuve | Validation par note ou lien uniquement (l’envoi d’une photo échoue) |
| Stripe | Optionnel | Carte bancaire, conséquences « Paiement Stripe » et « Don à une association » | Ces conséquences ne peuvent pas être activées |
| Clés VAPID | Optionnel | Notifications push (rappels, streak en danger…) | Réglages → Notifications indique que le serveur n’est pas configuré |

## Variables : build ou runtime ?

Focus est une app Nuxt. Dans `nuxt.config.ts`, la plupart des réglages (`runtimeConfig`) prennent leur valeur **au moment du build**. Au lancement, ils ne peuvent être surchargés que par une variable préfixée `NUXT_` (ou `NUXT_PUBLIC_` pour les valeurs exposées au navigateur).

Concrètement :

- **Plateformes qui buildent avec vos variables** (Railway, Render, `pnpm build:web` sur le serveur) : utilisez les noms simples (`GOOGLE_CLIENT_ID`, `S3_BUCKET`…), ils sont lus au build.
- **Image Docker buildée sans les variables, puis lancée avec** : les noms simples sont **ignorés** pour ces réglages. Utilisez les noms `NUXT_…` indiqués dans la [référence](#référence-des-variables).

Seules `DATABASE_URL`, `REDIS_URL`, `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` sont relues directement au lancement, sous leur nom simple.

> Vérifié sur un build de production : avec `GOOGLE_CLIENT_ID` passé au lancement, `/api/auth/google` répond 503 ; avec `NUXT_GOOGLE_CLIENT_ID`, il redirige bien vers Google.

## Checklist

### 1. Services obligatoires

- [ ] **PostgreSQL 13 ou plus récent** (les migrations utilisent `gen_random_uuid()`, natif depuis la 13). Une base vide suffit.
- [ ] **Redis 6 ou plus récent**, sans éviction de clés : les files BullMQ ne doivent pas être purgées (`maxmemory-policy noeviction`).
- [ ] Définir `DATABASE_URL` (`postgresql://utilisateur:motdepasse@hôte:5432/focus`) et `REDIS_URL` (`redis://…` ou `rediss://…`).

En local, `docker compose up -d` fournit les deux (voir le [README](../README.md#démarrage-avec-docker)).

### 2. Application web

- [ ] Node.js 22 et pnpm 10.
- [ ] `pnpm install --frozen-lockfile`
- [ ] Appliquer les migrations : `pnpm db:migrate` (idempotent, à relancer à chaque mise à jour).
- [ ] Définir l’URL publique : `APP_URL=https://focus.example.org` (sans `/` final). Elle sert aux redirections Google.
- [ ] Builder : `pnpm build:web`.
- [ ] Lancer : `node .output/server/index.mjs`. Le port se règle avec `PORT` (3000 par défaut).
- [ ] Servir l’app en **HTTPS** derrière votre reverse proxy : en production, le cookie de session est `Secure` et n’est pas envoyé en HTTP (sauf sur `localhost`).

### 3. Compte administrateur

- [ ] **Définir `ADMIN_EMAIL` avec votre propre adresse.** Le compte qui s’inscrit avec cette adresse (par email ou via Google) reçoit le rôle administrateur. Sans cette variable, aucun compte n’est administrateur.
- [ ] Optionnel : définir aussi `ADMIN_PASSWORD` pour que le compte admin soit créé automatiquement au démarrage (ou promu admin s’il existe déjà).
- [ ] Optionnel : `pnpm db:seed` ajoute des objectifs de démonstration au compte admin (qui doit déjà exister).

### 4. Workers

Les deux workers se lancent depuis le **dépôt complet** (ils s’exécutent avec `tsx`, pas depuis `.output`). Ils ont besoin de `DATABASE_URL` et `REDIS_URL`, et lisent aussi un fichier `.env` dans le répertoire courant s’il existe.

- [ ] **deadlines** : `pnpm worker`. Un passage au démarrage, puis toutes les 15 minutes : expiration des échéances, génération des 30 prochains jours, clôture des jours passés (streaks), classement quotidien et bonus du lundi.
- [ ] **consequences** : `pnpm worker:consequences`. Exécute les conséquences mises en file lors d’un échec (5 en parallèle, 3 tentatives). Il a besoin de `STRIPE_SECRET_KEY` si Stripe est activé. Au démarrage, il reprend les conséquences restées en attente.
- [ ] Un seul exemplaire de chaque worker suffit. Un verrou Redis évite de toute façon un double traitement des échéances.

**Railway** : le dépôt décrit l’infrastructure complète dans `.railway/railway.ts` (Infrastructure as Code). Sur votre propre projet Railway, adaptez le nom du dépôt GitHub dans ce fichier, liez le dossier (`railway link`), puis `railway config plan` et `railway config apply` créent les services web, `worker` et `consequences`, PostgreSQL et Redis. Les workers reçoivent les variables du web par référence. Ne leur donnez pas `NODE_ENV=production`, qui priverait le build de `tsx`.

**Docker / serveur** : le dépôt ne fournit pas encore de `Dockerfile`. Le plus simple est une image unique contenant le dépôt, `node_modules` et le build, lancée trois fois avec une commande différente :

| Service | Commande |
|---|---|
| web | `node .output/server/index.mjs` |
| deadlines | `pnpm worker` |
| consequences | `pnpm worker:consequences` |

Avec systemd, un service par commande, avec `Restart=on-failure`, fait l’affaire.

### 5. Google OAuth (optionnel)

- [ ] Dans la [Google Cloud Console](https://console.cloud.google.com/apis/credentials), configurer l’**écran de consentement OAuth** (type « Externe », scopes `openid`, `email`, `profile`).
- [ ] Créer un **identifiant OAuth 2.0** de type « Application Web ».
- [ ] **URI de redirection autorisé** : `https://focus.example.org/api/auth/google/callback`, identique à `APP_URL` suivi de `/api/auth/google/callback`.
- [ ] Définir `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` (ou `NUXT_GOOGLE_CLIENT_ID` / `NUXT_GOOGLE_CLIENT_SECRET`, voir [build ou runtime](#variables--build-ou-runtime-)).
- [ ] Vérifier : `/api/auth/google` doit rediriger vers `accounts.google.com`. Une erreur 503 signifie que les identifiants ne sont pas lus.

Seuls les comptes Google à email vérifié sont acceptés. Un compte existant avec le même email est automatiquement relié.

### 6. Stockage S3 des preuves (optionnel)

N’importe quel stockage compatible S3 convient (Railway Bucket, Cloudflare R2, MinIO, AWS S3…). Les photos sont compressées côté client puis envoyées **via le serveur** (5 Mo max), sous la clé `proofs/<utilisateur>/…`.

- [ ] Créer un bucket et une clé d’accès avec le droit d’écriture (`PutObject`).
- [ ] Définir `S3_BUCKET`, `S3_ENDPOINT` (ex. `https://<compte>.r2.cloudflarestorage.com`), `S3_ACCESS_KEY` et `S3_SECRET_KEY`. Les quatre sont nécessaires.
- [ ] **Rendre les objets lisibles publiquement à l’adresse `S3_ENDPOINT/S3_BUCKET/<clé>`.** C’est l’URL enregistrée et affichée (notamment en modération). Le client utilise l’adressage « path-style » et la région `auto`. Si votre fournisseur sert les fichiers publics sur un autre domaine, cette version ne permet pas encore de le configurer.
- [ ] Pas de configuration CORS nécessaire : le navigateur n’écrit jamais directement dans le bucket.

> Les photos de preuve sont accessibles à toute personne qui connaît leur URL (clé aléatoire, non listable). Informez-en vos utilisateurs.

### 7. Stripe (optionnel)

Stripe sert à enregistrer une carte (SetupIntent) puis à débiter l’utilisateur hors session quand une conséquence « Paiement Stripe » ou « Don à une association » s’exécute. Les dons s’accumulent dans des cagnottes par association, reversées manuellement depuis l’admin.

- [ ] Récupérer les clés dans le [tableau de bord Stripe](https://dashboard.stripe.com/apikeys) (mode test d’abord).
- [ ] Définir `STRIPE_SECRET_KEY` (`sk_…`) et `STRIPE_PUBLISHABLE_KEY` (`pk_…`, ou `NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` au runtime).
- [ ] Créer un **endpoint webhook** pointant vers `https://focus.example.org/api/stripe/webhook`, avec les événements :
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
- [ ] Définir `STRIPE_WEBHOOK_SECRET` (`whsec_…`, fourni par Stripe à la création de l’endpoint).
- [ ] Donner `STRIPE_SECRET_KEY` au **worker consequences**, qui effectue les débits.
- [ ] Tester en local : `stripe listen --forward-to localhost:3000/api/stripe/webhook` affiche un `whsec_…` à utiliser comme `STRIPE_WEBHOOK_SECRET`.
- [ ] Vérifier les associations proposées pour les dons dans **Admin → Cagnottes** : les migrations en créent 4 (WWF, Médecins Sans Frontières, Croix-Rouge, Restos du Cœur), que vous pouvez désactiver ou compléter.

Sans Stripe, les conséquences en crédits, « Utilisateur aléatoire », « Preuve obligatoire » et « Personnalisée » fonctionnent normalement. Les conséquences monétaires ne peuvent pas être activées sans carte enregistrée.

### 8. Notifications push (optionnel)

Les notifications push (Web Push) préviennent l’utilisateur avant une échéance, le soir si son streak est en danger, quand une conséquence s’exécute et quand il gagne un bonus de palier. Aucun service tiers n’est nécessaire : le serveur signe les envois avec une paire de clés VAPID.

- [ ] Générer une paire de clés, une seule fois : `npx web-push generate-vapid-keys`. **Ne la changez plus ensuite** : les abonnements existants deviendraient invalides.
- [ ] Définir `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `VAPID_SUBJECT` (`mailto:vous@example.org` ou l’URL de l’instance ; à défaut, `APP_URL` est utilisé).
- [ ] Donner ces trois variables **au service web et aux deux workers** : le web enregistre les abonnements et envoie les bonus de palier, `deadlines` envoie les rappels (toutes les 5 minutes), `consequences` notifie les conséquences exécutées.
- [ ] Ces variables sont lues au lancement sous leur nom simple (pas de `NUXT_` nécessaire).
- [ ] Vérifier : Réglages → Notifications → « Activer les notifications », puis « Envoyer une notification de test ».

Sur iPhone et iPad, les notifications ne fonctionnent que si Focus est installé sur l’écran d’accueil (iOS 16.4+).

### 9. Vérifications finales

- [ ] Créer un compte avec `ADMIN_EMAIL` → le menu « Administration » apparaît.
- [ ] Créer un objectif quotidien → l’échéance du jour apparaît sur l’accueil.
- [ ] Logs du worker deadlines : `[Worker] Done: …` toutes les 15 minutes.
- [ ] Logs du worker consequences : `[Consequences Worker] Démarré`.
- [ ] Si configurés : connexion Google, envoi d’une photo de preuve, enregistrement d’une carte de test (`4242 4242 4242 4242`).

## Référence des variables

« Runtime » indique le nom à utiliser si la variable est fournie **au lancement** d’un build qui ne la connaissait pas.

| Variable | Requise | Runtime | Rôle |
|---|---|---|---|
| `DATABASE_URL` | ✅ | `DATABASE_URL` | Connexion PostgreSQL (web, workers, migrations) |
| `REDIS_URL` | ✅ | `REDIS_URL` | Connexion Redis (web, workers) |
| `APP_URL` | ✅ | `NUXT_PUBLIC_APP_URL` | URL publique, sans `/` final |
| `ADMIN_EMAIL` | ✅ | `NUXT_ADMIN_EMAIL` | Email qui reçoit le rôle administrateur |
| `ADMIN_PASSWORD` | — | `NUXT_ADMIN_PASSWORD` | Crée le compte admin au démarrage |
| `PORT` | — | `PORT` | Port HTTP du service web (3000) |
| `GOOGLE_CLIENT_ID` | Google | `NUXT_GOOGLE_CLIENT_ID` | OAuth Google |
| `GOOGLE_CLIENT_SECRET` | Google | `NUXT_GOOGLE_CLIENT_SECRET` | OAuth Google |
| `S3_BUCKET` | S3 | `NUXT_S3_BUCKET` | Bucket des preuves |
| `S3_ENDPOINT` | S3 | `NUXT_S3_ENDPOINT` | Endpoint S3, sert aussi d’URL publique |
| `S3_ACCESS_KEY` | S3 | `NUXT_S3_ACCESS_KEY` | Clé d’accès |
| `S3_SECRET_KEY` | S3 | `NUXT_S3_SECRET_KEY` | Clé secrète |
| `STRIPE_SECRET_KEY` | Stripe | `STRIPE_SECRET_KEY` | API Stripe (web + worker consequences) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe | `NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Formulaire de carte côté navigateur |
| `STRIPE_WEBHOOK_SECRET` | Stripe | `STRIPE_WEBHOOK_SECRET` | Signature des webhooks |
| `VAPID_PUBLIC_KEY` | Push | `VAPID_PUBLIC_KEY` | Clé publique Web Push (web + workers) |
| `VAPID_PRIVATE_KEY` | Push | `VAPID_PRIVATE_KEY` | Clé privée Web Push (web + workers) |
| `VAPID_SUBJECT` | Push | `VAPID_SUBJECT` | Contact de l’instance (`mailto:` ou URL), `APP_URL` par défaut |
| `USERJOT_PROJECT_ID` | — | `NUXT_PUBLIC_USERJOT_PROJECT_ID` | Widget de feedback [UserJot](https://userjot.com) |
| `USERJOT_SECRET_KEY` | — | `NUXT_USERJOT_SECRET_KEY` | Identification signée des utilisateurs UserJot |

`SESSION_SECRET`, présent dans `.env.example`, n’est pas utilisé par le code actuel : les sessions sont des jetons aléatoires stockés en base.

## Limites connues

- **Pas d’envoi d’email.** « Mot de passe oublié » crée bien un jeton, mais le lien n’est envoyé à personne, et n’est affiché dans les logs qu’en développement. Tant que ce n’est pas implémenté, un administrateur doit aider l’utilisateur (connexion Google, ou réinitialisation en base).
- **Pas de `Dockerfile` officiel** : voir la [section Workers](#4-workers).
- **URL publique des preuves** : elle est toujours `S3_ENDPOINT/S3_BUCKET/<clé>`, sans domaine de CDN configurable.
