-- Mode pause / vacances : périodes pendant lesquelles les échéances de l'utilisateur
-- sont marquées « skipped » (aucun échec, aucune conséquence) et le streak est gelé.
-- Dates locales de l'utilisateur, bornes incluses.

CREATE TABLE IF NOT EXISTS "pause_periods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  -- Pause annulée avant de commencer
  "cancelled_at" timestamptz,
  -- Pause terminée plus tôt que prévu : date de fin initiale conservée pour l'historique
  "original_end_date" date,
  CONSTRAINT "pause_periods_range_check" CHECK ("end_date" >= "start_date")
);

CREATE INDEX IF NOT EXISTS "pause_periods_user_id_idx" ON "pause_periods" ("user_id");
