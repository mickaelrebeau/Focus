-- Conséquence « message d'accountability » : un email à un proche de confiance après un échec.
-- Double opt-in : l'utilisateur l'active (consentement dans la config), puis le contact
-- accepte depuis l'email d'invitation. Aucun message n'est envoyé à un contact non confirmé.

CREATE TABLE IF NOT EXISTS "accountability_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "name" text,
  "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'confirmed', 'declined')),
  -- Lien de gestion du consentement, repris dans chaque email : il doit rester lisible
  -- (il ne donne accès qu'à l'acceptation ou au refus de ce contact)
  "manage_token" text NOT NULL UNIQUE,
  "invited_at" timestamptz NOT NULL DEFAULT now(),
  "confirmed_at" timestamptz,
  "declined_at" timestamptz,
  -- Anti-spam : au plus un message par jour (fuseau de l'utilisateur) et par contact
  "last_message_date" date,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "accountability_contacts_user_email_unique" UNIQUE ("user_id", "email")
);

INSERT INTO "consequence_types" ("key", "name", "description", "icon", "enabled") VALUES
  ('accountability-message', 'Message à un proche', 'Envoie un email à une personne de confiance quand vous ne tenez pas un engagement. Elle doit d''abord accepter.', '✉', true)
ON CONFLICT ("key") DO NOTHING;
