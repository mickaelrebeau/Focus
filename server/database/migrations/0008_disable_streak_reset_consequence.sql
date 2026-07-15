UPDATE "consequence_types"
SET "enabled" = false
WHERE "key" = 'streak-reset';

DELETE FROM "user_consequences"
WHERE "type" = 'streak-reset';
