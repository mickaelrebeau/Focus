-- Report d'une échéance d'un jour : 1 par semaine ISO et par utilisateur, tracé.
-- L'échéance garde sa date (due_date) : seule l'heure limite (due_at) avance de 24 h.

-- Heure limite d'origine, renseignée une fois l'échéance reportée (une seule fois)
ALTER TABLE "occurrences" ADD COLUMN IF NOT EXISTS "original_due_at" timestamptz;

CREATE TABLE IF NOT EXISTS "occurrence_postponements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "occurrence_id" uuid NOT NULL UNIQUE REFERENCES "occurrences"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  -- Lundi de la semaine de la demande, dans le fuseau de l'utilisateur
  "week_start" date NOT NULL,
  "original_due_at" timestamptz NOT NULL,
  "new_due_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  -- Quota : un report par semaine, garanti même en cas de requêtes simultanées
  CONSTRAINT "occurrence_postponements_user_week_unique" UNIQUE ("user_id", "week_start")
);
