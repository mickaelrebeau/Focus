DO $$ BEGIN
  ALTER TYPE "credit_entry_type" ADD VALUE IF NOT EXISTS 'streak_bonus';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "credit_entry_type" ADD VALUE IF NOT EXISTS 'leaderboard_reward';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TYPE "daily_result_status" AS ENUM ('neutral', 'success', 'failed');

CREATE TABLE "user_daily_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "date_key" date NOT NULL,
  "status" "daily_result_status" NOT NULL,
  "total_occurrences" integer DEFAULT 0 NOT NULL,
  "completed_occurrences" integer DEFAULT 0 NOT NULL,
  "failed_occurrences" integer DEFAULT 0 NOT NULL,
  "evaluated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "user_daily_results_user_date_unique" ON "user_daily_results" ("user_id", "date_key");
CREATE INDEX "user_daily_results_date_key_idx" ON "user_daily_results" ("date_key");

CREATE TABLE "user_streaks" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "current_streak" integer DEFAULT 0 NOT NULL,
  "longest_streak" integer DEFAULT 0 NOT NULL,
  "last_success_date" date,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "streak_rewards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "milestone" integer NOT NULL,
  "amount" integer NOT NULL,
  "credit_ledger_id" uuid REFERENCES "credit_ledger"("id"),
  "awarded_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "streak_rewards_user_milestone_unique" ON "streak_rewards" ("user_id", "milestone");

CREATE TABLE "leaderboard_daily_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "week_key" text NOT NULL,
  "snapshot_date" date NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "rank" integer NOT NULL,
  "net_score" integer NOT NULL,
  "balance" integer NOT NULL,
  "debt" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "leaderboard_snapshots_date_user_unique" ON "leaderboard_daily_snapshots" ("snapshot_date", "user_id");
CREATE INDEX "leaderboard_snapshots_week_key_idx" ON "leaderboard_daily_snapshots" ("week_key");
CREATE INDEX "leaderboard_snapshots_week_user_idx" ON "leaderboard_daily_snapshots" ("week_key", "user_id");

CREATE TABLE "leaderboard_weekly_rewards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "week_key" text NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "final_rank" integer NOT NULL,
  "reward_amount" integer NOT NULL,
  "days_qualified" integer NOT NULL,
  "credit_ledger_id" uuid REFERENCES "credit_ledger"("id"),
  "settled_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "leaderboard_weekly_rewards_week_user_unique" ON "leaderboard_weekly_rewards" ("week_key", "user_id");
