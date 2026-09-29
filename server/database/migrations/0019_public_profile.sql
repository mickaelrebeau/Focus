-- Profil public optionnel (/u/:slug). Privé par défaut : pas de lien tant que public_slug est NULL.
-- Désactiver le profil efface le lien ; le réactiver en crée un nouveau (les anciens liens restent morts).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "public_slug" text UNIQUE;
