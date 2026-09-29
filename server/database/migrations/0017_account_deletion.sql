-- Suppression de compte (RGPD) : désactivation immédiate (deleted_at), puis purge
-- définitive par le worker après ACCOUNT_PURGE_DELAY_DAYS jours.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;
CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "users" ("deleted_at") WHERE "deleted_at" IS NOT NULL;

-- La purge supprime la ligne users : les références sans ON DELETE la bloqueraient.
-- Modération et journal d'audit gardent leur trace, sans l'auteur.
ALTER TABLE "validations" DROP CONSTRAINT IF EXISTS "validations_reviewed_by_fkey";
ALTER TABLE "validations" ADD CONSTRAINT "validations_reviewed_by_fkey"
  FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_actor_id_fkey";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL;

-- Un défi survit à la purge de son créateur : les autres participants gardent leur historique
ALTER TABLE "challenges" ALTER COLUMN "creator_id" DROP NOT NULL;
ALTER TABLE "challenges" DROP CONSTRAINT IF EXISTS "challenges_creator_id_fkey";
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_creator_id_fkey"
  FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL;
