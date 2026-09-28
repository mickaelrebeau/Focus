-- PostgreSQL traite les NULL comme distincts dans un index unique.
-- Les échéances récurrentes (milestone_id NULL) pouvaient donc être
-- insérées plusieurs fois pour le même objectif et la même date.

BEGIN;

CREATE TEMP TABLE occurrence_dupes ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    goal_id,
    due_date,
    milestone_id,
    row_number() OVER (
      PARTITION BY goal_id, due_date, milestone_id
      ORDER BY
        CASE status
          WHEN 'completed' THEN 0
          WHEN 'failed' THEN 1
          WHEN 'skipped' THEN 2
          ELSE 3
        END,
        created_at ASC,
        id ASC
    ) AS rn
  FROM occurrences
)
SELECT
  extra.id AS dupe_id,
  keeper.id AS keep_id
FROM ranked extra
JOIN ranked keeper
  ON keeper.goal_id = extra.goal_id
 AND keeper.due_date = extra.due_date
 AND keeper.milestone_id IS NOT DISTINCT FROM extra.milestone_id
 AND keeper.rn = 1
WHERE extra.rn > 1;

UPDATE validations validation
SET occurrence_id = dupe.keep_id
FROM occurrence_dupes dupe
WHERE validation.occurrence_id = dupe.dupe_id
  AND NOT EXISTS (
    SELECT 1 FROM validations existing
    WHERE existing.occurrence_id = dupe.keep_id
  );

DELETE FROM validations validation
USING occurrence_dupes dupe
WHERE validation.occurrence_id = dupe.dupe_id;

UPDATE consequence_history history
SET occurrence_id = dupe.keep_id
FROM occurrence_dupes dupe
WHERE history.occurrence_id = dupe.dupe_id
  AND NOT EXISTS (
    SELECT 1 FROM consequence_history existing
    WHERE existing.occurrence_id = dupe.keep_id
      AND existing.user_consequence_id = history.user_consequence_id
  );

DELETE FROM consequence_history history
USING occurrence_dupes dupe
WHERE history.occurrence_id = dupe.dupe_id;

DELETE FROM occurrences occurrence
USING occurrence_dupes dupe
WHERE occurrence.id = dupe.dupe_id;

DROP INDEX IF EXISTS "occurrences_goal_due_unique";

CREATE UNIQUE INDEX "occurrences_goal_due_unique"
  ON "occurrences" ("goal_id", "due_date", "milestone_id")
  NULLS NOT DISTINCT;

COMMIT;
