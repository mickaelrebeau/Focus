-- Délai de grâce avant échec : une échéance n'échoue qu'à due_at + grace_minutes.
-- 0 par défaut (comportement historique : échec dès due_at).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "grace_minutes" integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_grace_minutes_check" CHECK ("grace_minutes" IN (0, 15, 30, 60));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
