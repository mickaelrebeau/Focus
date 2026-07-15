UPDATE "consequence_types"
SET
  "description" = 'Transfère des crédits à un autre utilisateur actif tiré au hasard.',
  "updated_at" = now()
WHERE "key" = 'random-user';
