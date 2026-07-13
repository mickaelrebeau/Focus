ALTER TYPE "credit_entry_type" ADD VALUE IF NOT EXISTS 'transfer_received';
ALTER TYPE "credit_entry_type" ADD VALUE IF NOT EXISTS 'transfer_sent';

CREATE TABLE IF NOT EXISTS "donation_executions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "association" text NOT NULL,
  "amount" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'EUR',
  "consequence_history_id" uuid REFERENCES "consequence_history"("id") ON DELETE SET NULL,
  "stripe_payment_intent_id" text,
  "stripe_transfer_id" text,
  "status" text NOT NULL DEFAULT 'recorded',
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "donation_executions_user_id_idx" ON "donation_executions" ("user_id");
CREATE INDEX IF NOT EXISTS "donation_executions_association_idx" ON "donation_executions" ("association");
CREATE INDEX IF NOT EXISTS "donation_executions_status_idx" ON "donation_executions" ("status");

CREATE TABLE IF NOT EXISTS "community_pot_settings" (
  "id" text PRIMARY KEY DEFAULT 'default',
  "monthly_goal_cents" integer NOT NULL DEFAULT 50000,
  "target_association" text NOT NULL DEFAULT 'msf',
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "community_pot_settings" ("id", "monthly_goal_cents", "target_association")
VALUES ('default', 50000, 'msf')
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "community_pot_payouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "period" text NOT NULL,
  "association" text NOT NULL,
  "amount" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'EUR',
  "admin_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "community_pot_payouts_period_idx" ON "community_pot_payouts" ("period");
