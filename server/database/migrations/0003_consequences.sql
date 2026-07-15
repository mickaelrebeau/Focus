CREATE TYPE "consequence_history_status" AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled'
);

CREATE TABLE "consequence_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "icon" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "user_consequences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "amount" integer DEFAULT 0 NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "consequence_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "goal_id" uuid NOT NULL REFERENCES "goals"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "user_consequence_id" uuid NOT NULL REFERENCES "user_consequences"("id") ON DELETE CASCADE,
  "occurrence_id" uuid NOT NULL REFERENCES "occurrences"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "status" "consequence_history_status" DEFAULT 'pending' NOT NULL,
  "amount" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb,
  "executed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "community_pot_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount" integer NOT NULL,
  "currency" text DEFAULT 'EUR' NOT NULL,
  "consequence_history_id" uuid REFERENCES "consequence_history"("id") ON DELETE SET NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "internal_transfers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "from_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "to_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount" integer NOT NULL,
  "currency" text DEFAULT 'EUR' NOT NULL,
  "consequence_history_id" uuid REFERENCES "consequence_history"("id") ON DELETE SET NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "read" boolean DEFAULT false NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "user_consequences_user_id_idx" ON "user_consequences" ("user_id");
CREATE INDEX "user_consequences_user_priority_idx" ON "user_consequences" ("user_id", "priority");
CREATE UNIQUE INDEX "user_consequences_user_type_unique" ON "user_consequences" ("user_id", "type");

CREATE INDEX "consequence_history_user_id_idx" ON "consequence_history" ("user_id");
CREATE INDEX "consequence_history_goal_id_idx" ON "consequence_history" ("goal_id");
CREATE INDEX "consequence_history_status_idx" ON "consequence_history" ("status");
CREATE UNIQUE INDEX "consequence_history_occurrence_user_consequence_unique" ON "consequence_history" ("occurrence_id", "user_consequence_id");

CREATE INDEX "community_pot_transactions_user_id_idx" ON "community_pot_transactions" ("user_id");
CREATE INDEX "community_pot_transactions_created_at_idx" ON "community_pot_transactions" ("created_at");

CREATE INDEX "internal_transfers_from_user_id_idx" ON "internal_transfers" ("from_user_id");
CREATE INDEX "internal_transfers_to_user_id_idx" ON "internal_transfers" ("to_user_id");

CREATE INDEX "notifications_user_id_idx" ON "notifications" ("user_id");
CREATE INDEX "notifications_user_read_idx" ON "notifications" ("user_id", "read");

INSERT INTO "consequence_types" ("key", "name", "description", "icon", "enabled") VALUES
  ('credits', 'Perte de crédits', 'Retire des crédits de votre portefeuille, ou augmente votre dette si le solde est insuffisant.', '◈', true),
  ('donation', 'Don à une association', 'Engage un don vers une association lors d''un échec.', '♥', true),
  ('stripe', 'Paiement Stripe', 'Prélèvement automatique via Stripe (bientôt disponible).', '€', false),
  ('community-pot', 'Cagnotte commune', 'Ajoute le montant à une cagnotte commune partagée.', '◉', true),
  ('random-user', 'Utilisateur aléatoire', 'Transfère le montant à un autre utilisateur actif au hasard.', '↻', true),
  ('custom', 'Conséquence personnalisée', 'Rappel personnalisé de votre engagement.', '✎', true);

INSERT INTO "user_consequences" ("user_id", "type", "enabled", "amount", "priority", "config")
SELECT
  u.id,
  'credits',
  true,
  20,
  0,
  '{}'::jsonb
FROM "users" u
ON CONFLICT ("user_id", "type") DO NOTHING;
