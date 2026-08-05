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

## Bonnes pratiques pour les contributeurs

- Ne jamais committer de secrets (`.env`, clés Stripe, OAuth, S3, etc.)
- Utiliser des valeurs factices dans `.env.example` uniquement
- Signaler aussi les fuites accidentelles de credentials dans l’historique Git
