DO $$ BEGIN CREATE TYPE "user_role" AS ENUM('user', 'admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "goal_type" AS ENUM('one_time', 'recurring', 'project'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "recurrence_type" AS ENUM('daily', 'weekly_days', 'weekly_count'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "occurrence_status" AS ENUM('pending', 'completed', 'failed', 'skipped'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "validation_status" AS ENUM('pending_review', 'approved', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "credit_entry_type" AS ENUM('task_reward', 'task_penalty', 'debt_created', 'debt_repayment', 'admin_adjustment', 'signup_bonus'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "proof_type" AS ENUM('text', 'url', 'image'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "display_name" text NOT NULL,
  "role" "user_role" DEFAULT 'user' NOT NULL,
  "timezone" text DEFAULT 'Europe/Paris' NOT NULL,
  "is_blocked" boolean DEFAULT false NOT NULL,
  "leaderboard_opt_in" boolean DEFAULT true NOT NULL,
  "onboarding_completed" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" text NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" text NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "wallets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "balance" integer DEFAULT 0 NOT NULL,
  "debt" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "credit_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" "credit_entry_type" NOT NULL,
  "amount" integer NOT NULL,
  "balance_after" integer NOT NULL,
  "debt_after" integer NOT NULL,
  "occurrence_id" uuid,
  "goal_id" uuid,
  "admin_id" uuid,
  "reason" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "goals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "type" "goal_type" NOT NULL,
  "category" text,
  "recurrence_type" "recurrence_type",
  "recurrence_config" jsonb,
  "due_date" date,
  "reward_credits" integer DEFAULT 10 NOT NULL,
  "penalty_credits" integer DEFAULT 20 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "project_milestones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "goal_id" uuid NOT NULL REFERENCES "goals"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "order_index" integer DEFAULT 0 NOT NULL,
  "due_date" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "occurrences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "goal_id" uuid NOT NULL REFERENCES "goals"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "milestone_id" uuid REFERENCES "project_milestones"("id") ON DELETE SET NULL,
  "due_date" date NOT NULL,
  "due_at" timestamp with time zone NOT NULL,
  "status" "occurrence_status" DEFAULT 'pending' NOT NULL,
  "week_key" text,
  "processed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "validations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "occurrence_id" uuid NOT NULL UNIQUE REFERENCES "occurrences"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" "validation_status" DEFAULT 'pending_review' NOT NULL,
  "note" text,
  "proof_type" "proof_type",
  "proof_content" text,
  "proof_url" text,
  "reviewed_by" uuid REFERENCES "users"("id"),
  "reviewed_at" timestamp with time zone,
  "review_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_id" uuid REFERENCES "users"("id"),
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text,
  "details" jsonb,
  "ip_address" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" ("role");
CREATE INDEX IF NOT EXISTS "sessions_token_idx" ON "sessions" ("token");
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "credit_ledger_user_id_idx" ON "credit_ledger" ("user_id");
CREATE INDEX IF NOT EXISTS "credit_ledger_created_at_idx" ON "credit_ledger" ("created_at");
CREATE INDEX IF NOT EXISTS "goals_user_id_idx" ON "goals" ("user_id");
CREATE INDEX IF NOT EXISTS "goals_type_idx" ON "goals" ("type");
CREATE INDEX IF NOT EXISTS "project_milestones_goal_id_idx" ON "project_milestones" ("goal_id");
CREATE INDEX IF NOT EXISTS "occurrences_user_id_idx" ON "occurrences" ("user_id");
CREATE INDEX IF NOT EXISTS "occurrences_goal_id_idx" ON "occurrences" ("goal_id");
CREATE INDEX IF NOT EXISTS "occurrences_status_idx" ON "occurrences" ("status");
CREATE INDEX IF NOT EXISTS "occurrences_due_at_idx" ON "occurrences" ("due_at");
CREATE UNIQUE INDEX IF NOT EXISTS "occurrences_goal_due_unique" ON "occurrences" ("goal_id", "due_date", "milestone_id");
CREATE INDEX IF NOT EXISTS "validations_status_idx" ON "validations" ("status");
CREATE INDEX IF NOT EXISTS "validations_user_id_idx" ON "validations" ("user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_actor_id_idx" ON "audit_logs" ("actor_id");
