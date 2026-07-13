import { eq } from 'drizzle-orm'
import { useDatabase, schema } from '../database'
import type { creditEntryTypeEnum } from '../database/schema'

type CreditEntryType = typeof creditEntryTypeEnum.enumValues[number]

export const CREDITS_PER_EURO = 10

export function euroCentsToCredits(amountCents: number): number {
  return Math.max(1, Math.round((amountCents / 100) * CREDITS_PER_EURO))
}

interface CreditOperation {
  userId: string
  type: CreditEntryType
  amount: number
  occurrenceId?: string
  goalId?: string
  adminId?: string
  reason?: string
  metadata?: Record<string, unknown>
}

export async function applyCreditOperation(op: CreditOperation) {
  const db = useDatabase()

  return db.transaction(async (tx) => {
    const [wallet] = await tx
      .select()
      .from(schema.wallets)
      .where(eq(schema.wallets.userId, op.userId))
      .for('update')

    if (!wallet) {
      throw createError({ statusCode: 404, message: 'Portefeuille introuvable' })
    }

    let balance = wallet.balance
    let debt = wallet.debt
    const absAmount = Math.abs(op.amount)

    switch (op.type) {
      case 'task_reward':
      case 'signup_bonus':
      case 'streak_bonus':
      case 'leaderboard_reward':
      case 'transfer_received':
      case 'admin_adjustment': {
        let remaining = absAmount
        if (debt > 0) {
          const repayment = Math.min(debt, remaining)
          debt -= repayment
          remaining -= repayment
          if (repayment > 0) {
            await tx.insert(schema.creditLedger).values({
              userId: op.userId,
              type: 'debt_repayment',
              amount: repayment,
              balanceAfter: balance,
              debtAfter: debt,
              occurrenceId: op.occurrenceId,
              goalId: op.goalId,
              adminId: op.adminId,
              reason: op.reason,
              metadata: op.metadata,
            })
          }
        }
        balance += remaining
        break
      }
      case 'task_penalty': {
        const fromBalance = Math.min(balance, absAmount)
        balance -= fromBalance
        const remainingDebt = absAmount - fromBalance
        if (remainingDebt > 0) {
          debt += remainingDebt
          await tx.insert(schema.creditLedger).values({
            userId: op.userId,
            type: 'debt_created',
            amount: remainingDebt,
            balanceAfter: balance,
            debtAfter: debt,
            occurrenceId: op.occurrenceId,
            goalId: op.goalId,
            reason: op.reason,
            metadata: op.metadata,
          })
        }
        break
      }
      default:
        balance += op.amount
    }

    await tx
      .update(schema.wallets)
      .set({ balance, debt, updatedAt: new Date() })
      .where(eq(schema.wallets.userId, op.userId))

    const [entry] = await tx.insert(schema.creditLedger).values({
      userId: op.userId,
      type: op.type,
      amount: op.type === 'task_penalty' ? -absAmount : absAmount,
      balanceAfter: balance,
      debtAfter: debt,
      occurrenceId: op.occurrenceId,
      goalId: op.goalId,
      adminId: op.adminId,
      reason: op.reason,
      metadata: op.metadata,
    }).returning()

    return { wallet: { balance, debt }, entry }
  })
}

export function calculateNetScore(balance: number, debt: number): number {
  return balance - debt
}

export async function rewardCompletion(
  userId: string,
  amount: number,
  occurrenceId: string,
  goalId: string,
) {
  return applyCreditOperation({
    userId,
    type: 'task_reward',
    amount,
    occurrenceId,
    goalId,
  })
}

export async function applyPenalty(
  userId: string,
  amount: number,
  occurrenceId: string,
  goalId: string,
) {
  return applyCreditOperation({
    userId,
    type: 'task_penalty',
    amount: -amount,
    occurrenceId,
    goalId,
  })
}

export async function adminAdjustCredits(
  userId: string,
  amount: number,
  adminId: string,
  reason: string,
) {
  return applyCreditOperation({
    userId,
    type: 'admin_adjustment',
    amount,
    adminId,
    reason,
  })
}

export async function awardStreakBonus(
  userId: string,
  amount: number,
  milestone: number,
) {
  return applyCreditOperation({
    userId,
    type: 'streak_bonus',
    amount,
    reason: `Bonus streak ${milestone} jours`,
    metadata: { milestone, rewardType: 'streak_milestone' },
  })
}

export async function awardLeaderboardReward(
  userId: string,
  amount: number,
  weekKey: string,
  rank: number,
) {
  return applyCreditOperation({
    userId,
    type: 'leaderboard_reward',
    amount,
    reason: `Bonus Top ${rank} semaine ${weekKey}`,
    metadata: { weekKey, rank, rewardType: 'weekly_top3_streak' },
  })
}

export async function awardTransferReceived(
  userId: string,
  credits: number,
  fromUserId: string,
  amountCents: number,
  transferId: string,
) {
  return applyCreditOperation({
    userId,
    type: 'transfer_received',
    amount: credits,
    reason: `Transfert reçu (${amountCents / 100} €)`,
    metadata: {
      fromUserId,
      amountCents,
      transferId,
    },
  })
}
