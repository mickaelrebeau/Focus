ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "google_id" text;
CREATE UNIQUE INDEX "users_google_id_unique" ON "users" ("google_id");
