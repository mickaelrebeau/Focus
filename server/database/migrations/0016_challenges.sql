-- Défis entre amis : compétition d'une semaine ISO entre 2 et 8 personnes,
-- avec mise facultative en crédits internes (aucune dépendance Stripe).

ALTER TYPE "credit_entry_type" ADD VALUE IF NOT EXISTS 'challenge_stake';
ALTER TYPE "credit_entry_type" ADD VALUE IF NOT EXISTS 'challenge_refund';
ALTER TYPE "credit_entry_type" ADD VALUE IF NOT EXISTS 'challenge_payout';

CREATE TABLE IF NOT EXISTS "challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "creator_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "metric" text NOT NULL CHECK ("metric" IN ('perfect_days', 'completed_occurrences')),
  "week_start" date NOT NULL,
  "week_end" date NOT NULL,
  "stake_credits" integer NOT NULL DEFAULT 0 CHECK ("stake_credits" >= 0),
  "max_participants" integer NOT NULL DEFAULT 8 CHECK ("max_participants" BETWEEN 2 AND 8),
  -- Empreinte SHA-256 du lien d'invitation (réutilisable jusqu'à complet)
  "invite_token_hash" text NOT NULL UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "closed_at" timestamptz,
  "outcome" text CHECK ("outcome" IN ('completed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS "challenges_open_idx" ON "challenges" ("week_end") WHERE "closed_at" IS NULL;

CREATE TABLE IF NOT EXISTS "challenge_participants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "challenge_id" uuid NOT NULL REFERENCES "challenges"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "joined_at" timestamptz NOT NULL DEFAULT now(),
  "left_at" timestamptz,
  "stake_paid" integer NOT NULL DEFAULT 0,
  "final_score" integer,
  "final_rank" integer,
  "payout" integer NOT NULL DEFAULT 0,
  CONSTRAINT "challenge_participants_unique" UNIQUE ("challenge_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "challenge_participants_user_idx" ON "challenge_participants" ("user_id");

-- Notification de fin de défi (push), activée par défaut comme les autres types
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "challenge_results" boolean NOT NULL DEFAULT true;
