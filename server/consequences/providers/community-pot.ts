import { useDatabase, schema } from '../../database'
import { chargeUserForConsequence } from '../../utils/consequence-payment'
import {
  communityPotConfigSchema,
  type CommunityPotConfig,
  type ConsequenceProvider,
  formatEuroAmount,
} from '../types'

export const communityPotProvider: ConsequenceProvider<CommunityPotConfig> = {
  type: 'community-pot',

  async validate(config: unknown): Promise<CommunityPotConfig> {
    return communityPotConfigSchema.parse(config ?? {})
  },

  async estimate(_config: CommunityPotConfig, amount: number) {
    return {
      label: `+${formatEuroAmount(amount)} à la cagnotte`,
      description: `Un prélèvement de ${formatEuroAmount(amount)} sera effectué, puis ajouté à la cagnotte commune.`,
    }
  },

  async execute(payload) {
    const payment = await chargeUserForConsequence('community-pot', payload)
    const db = useDatabase()

    const [transaction] = await db.insert(schema.communityPotTransactions).values({
      userId: payload.userId,
      amount: payload.amount,
      currency: 'EUR',
      consequenceHistoryId: payload.historyId,
      metadata: {
        goalId: payload.goalId,
        occurrenceId: payload.occurrenceId,
        paymentIntentId: payment.paymentIntentId,
      },
    }).returning()

    return {
      transactionId: transaction.id,
      amountCents: payload.amount,
      currency: 'EUR',
      paymentIntentId: payment.paymentIntentId,
      recordId: payment.recordId,
    }
  },
}
