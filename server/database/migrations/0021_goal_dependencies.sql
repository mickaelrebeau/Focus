-- Dépendances : un objectif après un autre, et des jalons en chaîne (« B après A »).
-- dependency_mode : 'soft' = simple affichage ; 'hard' = aucune échéance tant que le prérequis
-- n'est pas réussi (il s'applique à la dépendance de l'objectif et à la chaîne de ses jalons).
-- ON DELETE SET NULL : supprimer un prérequis débloque ce qui en dépendait.

ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "depends_on_goal_id" uuid REFERENCES "goals"("id") ON DELETE SET NULL;
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "dependency_mode" text NOT NULL DEFAULT 'hard'
  CHECK ("dependency_mode" IN ('soft', 'hard'));
CREATE INDEX IF NOT EXISTS "goals_depends_on_goal_id_idx" ON "goals" ("depends_on_goal_id") WHERE "depends_on_goal_id" IS NOT NULL;

ALTER TABLE "project_milestones" ADD COLUMN IF NOT EXISTS "depends_on_milestone_id" uuid
  REFERENCES "project_milestones"("id") ON DELETE SET NULL;
