# Politique de sécurité

## Versions supportées

Les correctifs de sécurité sont appliqués sur la branche `main` du dépôt public.

## Signaler une vulnérabilité

Ne créez **pas** d’issue publique pour une faille de sécurité.

Préférez :

1. [GitHub Security Advisories](https://github.com/mickaelrebeau/Focus/security/advisories/new) (privé), ou
2. un contact direct via le profil GitHub du mainteneur : [@mickaelrebeau](https://github.com/mickaelrebeau)

Incluez si possible :

- une description claire de la vulnérabilité
- les étapes de reproduction ou une PoC minimale
- l’impact estimé (auth, données, paiements Stripe, etc.)
- votre environnement de test

## Délai de réponse

Nous visons un accusé de réception sous **7 jours**, puis une correction ou un plan de mitigation raisonnable selon la gravité.

## Données personnelles (RGPD)

Chaque utilisateur peut, depuis Réglages → Vos données :

- **exporter** toutes ses données au format JSON (droit d’accès et de portabilité) ;
- **supprimer** son compte, après confirmation par son email et son mot de passe (droit à l’effacement).

L’export exclut tous les secrets : empreintes de mot de passe, jetons de session et d’invitation, clés push, identifiants Stripe et Google, ainsi que les données d’autres utilisateurs. La suppression coupe immédiatement l’accès, les échéances, les conséquences et les paiements, et efface les preuves S3 et le client Stripe ; la base est purgée après un délai de rétention (30 jours par défaut).

Détails, rétention et responsabilités de l’hébergeur : [docs/self-hosting.md](docs/self-hosting.md#données-personnelles-rgpd). Une fuite de données personnelles se signale comme une vulnérabilité (voir ci-dessus).

## Bonnes pratiques pour les contributeurs

- Ne jamais committer de secrets (`.env`, clés Stripe, OAuth, S3, etc.)
- Utiliser des valeurs factices dans `.env.example` uniquement
- Signaler aussi les fuites accidentelles de credentials dans l’historique Git
