import { applyPenalty } from '../../utils/credits'
import {
  creditsConfigSchema,
  type ConsequenceProvider,
  type CreditsConfig,
} from '../types'

export const creditsProvider: ConsequenceProvider<CreditsConfig> = {
  type: 'credits',

  async validate(config: unknown): Promise<CreditsConfig> {
    return creditsConfigSchema.parse(config ?? {})
  },

  async estimate(_config: CreditsConfig, amount: number) {
    return {
      label: `-${amount} crédits`,
      description: `Retrait de ${amount} crédits de votre portefeuille. Si le solde est insuffisant, la dette sera augmentée.`,
    }
  },

  async execute(payload) {
    const { userId, amount, occurrenceId, goalId } = payload

    if (amount <= 0) {
      return { skipped: true, reason: 'Montant nul' }
    }

    const result = await applyPenalty(userId, amount, occurrenceId, goalId)

    return {
      balanceAfter: result.wallet.balance,
      debtAfter: result.wallet.debt,
      ledgerEntryId: result.entry.id,
    }
  },
}
