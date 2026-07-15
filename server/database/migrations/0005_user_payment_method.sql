ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_payment_method_id" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_payment_method_brand" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_payment_method_last4" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_payment_method_exp_month" integer;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_payment_method_exp_year" integer;

UPDATE "users" u
SET
  "stripe_payment_method_id" = uc.config->>'paymentMethodId',
  "stripe_payment_method_brand" = uc.config->>'paymentMethodBrand',
  "stripe_payment_method_last4" = uc.config->>'paymentMethodLast4',
  "stripe_payment_method_exp_month" = NULLIF(uc.config->>'paymentMethodExpMonth', '')::integer,
  "stripe_payment_method_exp_year" = NULLIF(uc.config->>'paymentMethodExpYear', '')::integer
FROM "user_consequences" uc
WHERE uc.user_id = u.id
  AND uc.type = 'stripe'
  AND (uc.config->>'paymentMethodId') IS NOT NULL
  AND u.stripe_payment_method_id IS NULL;
