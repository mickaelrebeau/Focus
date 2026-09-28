import { describe, it, expect, vi, beforeEach } from 'vitest'

// Portefeuille et registre simulés, pour observer les effets de applyCreditOperation
const state = vi.hoisted(() => ({
  wallet: { balance: 0, debt: 0 },
  ledger: [] as Array<{ type: string, amount: number, balanceAfter: number, debtAfter: number, adminId?: string }>,
}))

vi.mock('../../server/database', () => {
  const tx = {
    select: () => ({ from: () => ({ where: () => ({ for: async () => [{ ...state.wallet }] }) }) }),
    update: () => ({
      set: (values: { balance: number, debt: number }) => ({
        where: async () => {
          state.wallet = { balance: values.balance, debt: values.debt }
        },
      }),
    }),
    insert: () => ({
      values: (row: (typeof state.ledger)[number]) => {
        state.ledger.push(row)
        return Object.assign(Promise.resolve(), { returning: async () => [{ id: `entry-${state.ledger.length}`, ...row }] })
      },
    }),
  }
  return {
    schema: { wallets: { userId: 'wallets.user_id' }, creditLedger: {} },
    useDatabase: () => ({ transaction: async (callback: (t: typeof tx) => unknown) => callback(tx) }),
  }
})

import { adminAdjustCredits, applyPenalty, isDebitOperation, rewardCompletion } from '../../server/utils/credits'
import { adminAdjustSchema } from '../../server/utils/validation'

function setWallet(balance: number, debt: number) {
  state.wallet = { balance, debt }
  state.ledger = []
}

describe('ajustement admin', () => {
  beforeEach(() => setWallet(50, 0))

  it('un ajustement négatif retire des crédits (il en ajoutait avant le correctif)', async () => {
    const result = await adminAdjustCredits('user-1', -30, 'admin-1', 'Correction de solde')
    expect(result.wallet).toEqual({ balance: 20, debt: 0 })
    expect(state.ledger).toEqual([
      expect.objectContaining({ type: 'admin_adjustment', amount: -30, balanceAfter: 20, debtAfter: 0, adminId: 'admin-1' }),
    ])
  })

  it('au-delà du solde, un ajustement négatif crée de la dette', async () => {
    const result = await adminAdjustCredits('user-1', -80, 'admin-1', 'Correction de solde')
    expect(result.wallet).toEqual({ balance: 0, debt: 30 })
    expect(state.ledger.map(entry => [entry.type, entry.amount])).toEqual([
      ['debt_created', 30],
      ['admin_adjustment', -80],
    ])
    expect(state.ledger[0]).toMatchObject({ adminId: 'admin-1' })
  })

  it('un ajustement positif ajoute toujours des crédits', async () => {
    const result = await adminAdjustCredits('user-1', 15, 'admin-1', 'Geste commercial')
    expect(result.wallet).toEqual({ balance: 65, debt: 0 })
    expect(state.ledger).toEqual([expect.objectContaining({ type: 'admin_adjustment', amount: 15 })])
  })

  it('refuse un montant nul', () => {
    expect(adminAdjustSchema.safeParse({ amount: 0, reason: 'Aucun effet' }).success).toBe(false)
    expect(adminAdjustSchema.safeParse({ amount: -5, reason: 'Correction' }).success).toBe(true)
  })
})

describe('non-régression', () => {
  it('une récompense rembourse d’abord la dette', async () => {
    setWallet(0, 15)
    const result = await rewardCompletion('user-1', 10, 'occ-1', 'goal-1')
    expect(result.wallet).toEqual({ balance: 0, debt: 5 })
    expect(state.ledger.map(entry => [entry.type, entry.amount])).toEqual([
      ['debt_repayment', 10],
      ['task_reward', 10],
    ])
  })

  it('une pénalité puise le solde puis crée de la dette', async () => {
    setWallet(5, 0)
    const result = await applyPenalty('user-1', 20, 'occ-1', 'goal-1')
    expect(result.wallet).toEqual({ balance: 0, debt: 15 })
    expect(state.ledger.map(entry => [entry.type, entry.amount])).toEqual([
      ['debt_created', 15],
      ['task_penalty', -20],
    ])
  })

  it('classe les opérations de débit', () => {
    expect(isDebitOperation({ type: 'task_penalty', amount: -20 })).toBe(true)
    expect(isDebitOperation({ type: 'transfer_sent', amount: 10 })).toBe(true)
    expect(isDebitOperation({ type: 'admin_adjustment', amount: -1 })).toBe(true)
    expect(isDebitOperation({ type: 'admin_adjustment', amount: 1 })).toBe(false)
    expect(isDebitOperation({ type: 'task_reward', amount: 10 })).toBe(false)
    expect(isDebitOperation({ type: 'challenge_stake', amount: -10 })).toBe(true)
    expect(isDebitOperation({ type: 'challenge_payout', amount: 30 })).toBe(false)
    expect(isDebitOperation({ type: 'challenge_refund', amount: 10 })).toBe(false)
  })
})
