import { describe, it, expect, vi, beforeEach } from 'vitest'
import { creditsProvider } from '../../server/consequences/providers/credits'
import { donationProvider } from '../../server/consequences/providers/donation'
import { communityPotProvider } from '../../server/consequences/providers/community-pot'
import { customProvider } from '../../server/consequences/providers/custom'
import { stripeProvider } from '../../server/consequences/providers/stripe'

vi.mock('../../server/utils/credits', () => ({
  applyPenalty: vi.fn(async () => ({
    wallet: { balance: 10, debt: 5 },
    entry: { id: 'ledger-1' },
  })),
  awardTransferReceived: vi.fn(async () => ({
    wallet: { balance: 60, debt: 0 },
    entry: { id: 'ledger-transfer-1' },
  })),
  euroCentsToCredits: vi.fn((amountCents: number) => Math.round((amountCents / 100) * 10)),
}))

vi.mock('../../server/utils/consequence-payment', () => ({
  chargeUserForConsequence: vi.fn(async () => ({
    paymentIntentId: 'pi_test',
    status: 'succeeded',
    recordId: 'sp_test',
  })),
}))

vi.mock('../../server/utils/donation-service', () => ({
  processDonationExecution: vi.fn(async () => ({
    executionId: 'donation-1',
    status: 'transferred',
    stripeTransferId: 'tr_test',
    associationLabel: 'WWF',
  })),
}))

vi.mock('../../server/utils/notifications', () => ({
  createNotification: vi.fn(async () => ({ id: 'notif-1' })),
}))

vi.mock('../../server/database', () => ({
  useDatabase: vi.fn(),
  schema: {
    notifications: { id: 'notifications.id' },
    communityPotTransactions: { id: 'community_pot_transactions.id' },
    internalTransfers: { id: 'internal_transfers.id' },
    users: { id: 'users.id', isBlocked: 'users.is_blocked' },
    wallets: { userId: 'wallets.user_id', balance: 'wallets.balance', debt: 'wallets.debt' },
  },
}))

import { applyPenalty } from '../../server/utils/credits'
import { chargeUserForConsequence } from '../../server/utils/consequence-payment'
import { useDatabase } from '../../server/database'

describe('consequences execution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('executes credits provider via applyPenalty', async () => {
    const result = await creditsProvider.execute({
      historyId: 'history-1',
      userId: 'user-1',
      goalId: 'goal-1',
      occurrenceId: 'occ-1',
      amount: 20,
      config: {},
    })

    expect(applyPenalty).toHaveBeenCalledWith('user-1', 20, 'occ-1', 'goal-1')
    expect(chargeUserForConsequence).not.toHaveBeenCalled()
    expect(result).toEqual({
      balanceAfter: 10,
      debtAfter: 5,
      ledgerEntryId: 'ledger-1',
    })
  })

  it('skips credits execution when amount is zero', async () => {
    const result = await creditsProvider.execute({
      historyId: 'history-1',
      userId: 'user-1',
      goalId: 'goal-1',
      occurrenceId: 'occ-1',
      amount: 0,
      config: {},
    })

    expect(applyPenalty).not.toHaveBeenCalled()
    expect(chargeUserForConsequence).not.toHaveBeenCalled()
    expect(result).toEqual({ skipped: true, reason: 'Montant nul' })
  })

  it('executes donation provider with card charge', async () => {
    const result = await donationProvider.execute({
      historyId: 'history-1',
      userId: 'user-1',
      goalId: 'goal-1',
      occurrenceId: 'occ-1',
      amount: 500,
      config: { association: 'wwf' },
    })

    expect(chargeUserForConsequence).toHaveBeenCalledWith('donation', expect.objectContaining({
      historyId: 'history-1',
      amount: 500,
    }))
    expect(result).toMatchObject({
      status: 'transferred',
      association: 'wwf',
      amountCents: 500,
      paymentIntentId: 'pi_test',
    })
  })

  it('executes community-pot provider with card charge', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 'pot-1' }])
    const values = vi.fn().mockReturnValue({ returning })
    const insert = vi.fn().mockReturnValue({ values })

    vi.mocked(useDatabase).mockReturnValue({
      insert,
    } as never)

    const result = await communityPotProvider.execute({
      historyId: 'history-1',
      userId: 'user-1',
      goalId: 'goal-1',
      occurrenceId: 'occ-1',
      amount: 500,
      config: {},
    })

    expect(chargeUserForConsequence).toHaveBeenCalledWith('community-pot', expect.any(Object))
    expect(insert).toHaveBeenCalled()
    expect(result).toMatchObject({
      transactionId: 'pot-1',
      paymentIntentId: 'pi_test',
    })
  })

  it('executes custom provider by creating a notification', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 'notif-1' }])
    const values = vi.fn().mockReturnValue({ returning })
    const insert = vi.fn().mockReturnValue({ values })

    vi.mocked(useDatabase).mockReturnValue({
      insert,
    } as never)

    const result = await customProvider.execute({
      historyId: 'history-1',
      userId: 'user-1',
      goalId: 'goal-1',
      occurrenceId: 'occ-1',
      amount: 0,
      config: { message: 'Faire 100 pompes' },
    })

    expect(chargeUserForConsequence).not.toHaveBeenCalled()
    expect(insert).toHaveBeenCalled()
    expect(result.notificationId).toBe('notif-1')
    expect(result.message).toContain('Faire 100 pompes')
  })

  it('executes stripe provider with off-session payment', async () => {
    const result = await stripeProvider.execute({
      historyId: 'history-1',
      userId: 'user-1',
      goalId: 'goal-1',
      occurrenceId: 'occ-1',
      amount: 500,
      config: {},
    })

    expect(chargeUserForConsequence).toHaveBeenCalledWith('stripe', expect.any(Object))
    expect(result).toMatchObject({
      status: 'succeeded',
      paymentIntentId: 'pi_test',
      amountCents: 500,
    })
  })
})
