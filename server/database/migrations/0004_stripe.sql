ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text UNIQUE;

CREATE TABLE IF NOT EXISTS "stripe_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "consequence_history_id" uuid REFERENCES "consequence_history"("id") ON DELETE SET NULL,
  "payment_intent_id" text NOT NULL UNIQUE,
  "amount" integer NOT NULL,
  "currency" text DEFAULT 'EUR' NOT NULL,
  "status" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "stripe_payments_user_id_idx" ON "stripe_payments" ("user_id");
CREATE INDEX IF NOT EXISTS "stripe_payments_status_idx" ON "stripe_payments" ("status");

UPDATE "consequence_types"
SET
  "enabled" = true,
  "description" = 'Prélèvement automatique sur votre carte enregistrée en cas d''échec.',
  "updated_at" = now()
WHERE "key" = 'stripe';
