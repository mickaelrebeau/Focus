# Infrastructure Railway (IaC)

`.railway/railway.ts` décrit l'infrastructure de production du projet Railway « Focus » : service web, workers `worker` et `consequences`, PostgreSQL, Redis, volumes et bucket. Il remplace `railway.toml` (Config as Code, déprécié par Railway).

Les secrets ne sont jamais écrits ici : `preserve()` conserve la valeur définie dans Railway, et les workers reçoivent les variables du web par référence (`Focus.env.DATABASE_URL`…).

## Prérequis

- CLI Railway 5.49.1 ou plus récente, connectée (`railway login`).
- Dépôt lié au projet : `railway link --project <id> --environment production`.
- SDK installé (`pnpm install`, dépendance de dev `railway`).

## Modifier l'infrastructure

1. Éditer `.railway/railway.ts`.
2. Prévisualiser : `railway config plan`. Le plan ne modifie rien.
3. Relire le diff, puis appliquer : `railway config apply`.

Pour appliquer exactement ce qui a été relu (recommandé en CI) :

```bash
railway config plan --out /tmp/railway-plan.json
railway config apply --plan /tmp/railway-plan.json
```

Vérifier l'absence de dérive entre le code et Railway :

```bash
railway config plan --detailed-exit-code   # 0 : à jour, 2 : différences
```

## Points d'attention

- Ne déclarez pas les valeurs par défaut de Railway (par exemple `restartPolicyType: "ON_FAILURE"`) : elles sont relues comme vides et produiraient une différence permanente dans le plan.
- Un changement de réglage d'un service appliqué ici déclenche un redéploiement de ce service.
- Workers : ne pas leur donner `NODE_ENV=production`, sinon pnpm n'installe pas `tsx` (devDependency).
- Ne réintroduisez pas de `railway.toml` / `railway.json` : un service ne peut pas être géré à la fois par ces fichiers et par l'IaC.
