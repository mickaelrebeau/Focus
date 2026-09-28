-- Notifications push (Web Push / VAPID).
-- Un abonnement par appareil ; aucune notification n'est envoyée sans abonnement actif.

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "endpoint" text NOT NULL UNIQUE,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "last_success_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_idx" ON "push_subscriptions" ("user_id");

-- Préférences par type. Elles ne s'appliquent que si l'utilisateur a un abonnement actif.
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "due_reminder" boolean NOT NULL DEFAULT true,
  "due_reminder_minutes" integer NOT NULL DEFAULT 60,
  "streak_at_risk" boolean NOT NULL DEFAULT true,
  "consequence_executed" boolean NOT NULL DEFAULT true,
  "milestone_bonus" boolean NOT NULL DEFAULT true,
  -- Langue des notifications (choisie dans l'app au moment de l'abonnement)
  "locale" text NOT NULL DEFAULT 'fr',
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Journal des envois : la contrainte unique garantit qu'un même événement
-- (rappel d'une échéance, streak en danger d'un jour…) n'est notifié qu'une fois.
CREATE TABLE IF NOT EXISTS "push_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "ref_key" text NOT NULL,
  "sent_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_deliveries_user_kind_ref_unique"
  ON "push_deliveries" ("user_id", "kind", "ref_key");
