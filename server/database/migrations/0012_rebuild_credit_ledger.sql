-- Rejoue le portefeuille sans les crédits et pénalités des échéances dupliquées,
-- supprimées par 0011. La dette et le solde suivent les mêmes règles que
-- applyCreditOperation : un gain rembourse d'abord la dette, une pénalité
-- puise le solde puis crée de la dette.

BEGIN;

CREATE TEMP TABLE credit_source ON COMMIT DROP AS
SELECT
  l.id,
  l.user_id,
  l.type,
  l.amount,
  l.occurrence_id,
  l.goal_id,
  l.admin_id,
  l.reason,
  l.metadata,
  l.created_at
FROM credit_ledger l
LEFT JOIN occurrences o ON o.id = l.occurrence_id
WHERE l.type IN (
    'signup_bonus',
    'streak_bonus',
    'leaderboard_reward',
    'transfer_received',
    'transfer_sent',
    'admin_adjustment'
  )
  OR (
    l.type IN ('task_reward', 'task_penalty')
    AND o.id IS NOT NULL
  );

UPDATE streak_rewards
SET credit_ledger_id = NULL
WHERE credit_ledger_id IS NOT NULL;

UPDATE leaderboard_weekly_rewards
SET credit_ledger_id = NULL
WHERE credit_ledger_id IS NOT NULL;

DELETE FROM credit_ledger;

DO $$
DECLARE
  rec record;
  active_user_id uuid := NULL;
  bal integer := 0;
  deb integer := 0;
  abs_amount integer;
  remaining integer;
  repayment integer;
  from_balance integer;
  remaining_debt integer;
BEGIN
  FOR rec IN
    SELECT * FROM credit_source
    ORDER BY user_id, created_at, id
  LOOP
    IF active_user_id IS DISTINCT FROM rec.user_id THEN
      IF active_user_id IS NOT NULL THEN
        UPDATE wallets
        SET balance = bal, debt = deb, updated_at = now()
        WHERE user_id = active_user_id;
      END IF;
      active_user_id := rec.user_id;
      bal := 0;
      deb := 0;
    END IF;

    abs_amount := abs(rec.amount);

    IF rec.type IN (
      'task_reward',
      'signup_bonus',
      'streak_bonus',
      'leaderboard_reward',
      'transfer_received',
      'admin_adjustment'
    ) THEN
      remaining := abs_amount;
      IF deb > 0 THEN
        repayment := least(deb, remaining);
        deb := deb - repayment;
        remaining := remaining - repayment;
        IF repayment > 0 THEN
          INSERT INTO credit_ledger (
            user_id, type, amount, balance_after, debt_after,
            occurrence_id, goal_id, admin_id, reason, metadata, created_at
          ) VALUES (
            rec.user_id, 'debt_repayment', repayment, bal, deb,
            rec.occurrence_id, rec.goal_id, rec.admin_id, rec.reason, rec.metadata,
            rec.created_at - interval '1 millisecond'
          );
        END IF;
      END IF;
      bal := bal + remaining;
      INSERT INTO credit_ledger (
        user_id, type, amount, balance_after, debt_after,
        occurrence_id, goal_id, admin_id, reason, metadata, created_at
      ) VALUES (
        rec.user_id, rec.type, abs_amount, bal, deb,
        rec.occurrence_id, rec.goal_id, rec.admin_id, rec.reason, rec.metadata,
        rec.created_at
      );
    ELSIF rec.type = 'task_penalty' THEN
      from_balance := least(bal, abs_amount);
      bal := bal - from_balance;
      remaining_debt := abs_amount - from_balance;
      IF remaining_debt > 0 THEN
        deb := deb + remaining_debt;
        INSERT INTO credit_ledger (
          user_id, type, amount, balance_after, debt_after,
          occurrence_id, goal_id, admin_id, reason, metadata, created_at
        ) VALUES (
          rec.user_id, 'debt_created', remaining_debt, bal, deb,
          rec.occurrence_id, rec.goal_id, rec.admin_id, rec.reason, rec.metadata,
          rec.created_at - interval '1 millisecond'
        );
      END IF;
      INSERT INTO credit_ledger (
        user_id, type, amount, balance_after, debt_after,
        occurrence_id, goal_id, admin_id, reason, metadata, created_at
      ) VALUES (
        rec.user_id, 'task_penalty', -abs_amount, bal, deb,
        rec.occurrence_id, rec.goal_id, rec.admin_id, rec.reason, rec.metadata,
        rec.created_at
      );
    ELSE
      bal := bal + rec.amount;
      INSERT INTO credit_ledger (
        user_id, type, amount, balance_after, debt_after,
        occurrence_id, goal_id, admin_id, reason, metadata, created_at
      ) VALUES (
        rec.user_id, rec.type, rec.amount, bal, deb,
        rec.occurrence_id, rec.goal_id, rec.admin_id, rec.reason, rec.metadata,
        rec.created_at
      );
    END IF;
  END LOOP;

  IF active_user_id IS NOT NULL THEN
    UPDATE wallets
    SET balance = bal, debt = deb, updated_at = now()
    WHERE user_id = active_user_id;
  END IF;
END $$;

COMMIT;
