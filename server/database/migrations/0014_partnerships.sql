-- Binôme de responsabilité : deux utilisateurs voient mutuellement leur statut du jour
-- (sans titres d'objectifs, preuves, crédits ni conséquences).

CREATE TABLE IF NOT EXISTS "partnerships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "inviter_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "partner_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  -- Empreinte SHA-256 du jeton d'invitation : le jeton lui-même n'est jamais stocké
  "invite_token_hash" text NOT NULL UNIQUE,
  "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'active', 'revoked')),
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "accepted_at" timestamptz,
  "revoked_at" timestamptz,
  "revoked_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "partnerships_not_self" CHECK ("partner_id" IS NULL OR "partner_id" <> "inviter_id")
);

CREATE INDEX IF NOT EXISTS "partnerships_inviter_id_idx" ON "partnerships" ("inviter_id");
CREATE INDEX IF NOT EXISTS "partnerships_partner_id_idx" ON "partnerships" ("partner_id");
