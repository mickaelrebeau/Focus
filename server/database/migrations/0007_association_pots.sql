CREATE TABLE IF NOT EXISTS "associations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text,
  "logo_url" text,
  "enabled" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "associations_enabled_sort_idx" ON "associations" ("enabled", "sort_order");

INSERT INTO "associations" ("slug", "name", "description", "sort_order")
VALUES
  ('wwf', 'WWF', 'Protection de la nature et des espèces menacées.', 0),
  ('msf', 'Médecins Sans Frontières', 'Soins médicaux d''urgence dans le monde.', 1),
  ('croix-rouge', 'Croix-Rouge', 'Aide humanitaire et secours d''urgence.', 2),
  ('restos-coeur', 'Restos du Cœur', 'Aide alimentaire et accompagnement social.', 3)
ON CONFLICT ("slug") DO NOTHING;

CREATE TABLE IF NOT EXISTS "association_pot_payouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "association_slug" text NOT NULL REFERENCES "associations"("slug") ON DELETE RESTRICT,
  "period" text NOT NULL,
  "amount" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'EUR',
  "admin_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "association_pot_payouts_slug_idx" ON "association_pot_payouts" ("association_slug");
CREATE INDEX IF NOT EXISTS "association_pot_payouts_period_idx" ON "association_pot_payouts" ("period");

CREATE UNIQUE INDEX IF NOT EXISTS "donation_executions_history_unique"
  ON "donation_executions" ("consequence_history_id")
  WHERE "consequence_history_id" IS NOT NULL;

UPDATE "donation_executions"
SET "status" = 'accumulated'
WHERE "status" IN ('recorded', 'transfer_failed');

CREATE TABLE IF NOT EXISTS "proof_requirements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "goal_id" uuid NOT NULL REFERENCES "goals"("id") ON DELETE CASCADE,
  "consequence_history_id" uuid UNIQUE REFERENCES "consequence_history"("id") ON DELETE SET NULL,
  "consumed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "proof_requirements_user_goal_pending_idx"
  ON "proof_requirements" ("user_id", "goal_id")
  WHERE "consumed_at" IS NULL;

UPDATE "consequence_types"
SET "enabled" = false
WHERE "key" = 'community-pot';

INSERT INTO "consequence_types" ("key", "name", "description", "icon", "enabled")
VALUES
  ('streak-reset', 'Perte du streak', 'Remet votre série de jours parfaits à zéro après un échec.', '↺', true),
  ('mandatory-proof', 'Preuve obligatoire', 'Exige une preuve pour valider votre prochaine réussite sur cet objectif.', '◌', true)
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "icon" = EXCLUDED."icon",
  "enabled" = EXCLUDED."enabled";
