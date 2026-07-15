import { ConsequenceError } from '../errors'
import {
  donationConfigSchema,
  type ConsequenceProvider,
  type DonationConfig,
  formatEuroAmount,
} from '../types'
import { chargeUserForConsequence } from '../../utils/consequence-payment'
import { processDonationExecution } from '../../utils/donation-service'
import { getActiveAssociationBySlug } from '../../utils/associations'

export const donationProvider: ConsequenceProvider<DonationConfig> = {
  type: 'donation',

  async validate(config: unknown): Promise<DonationConfig> {
    const parsed = donationConfigSchema.parse(config ?? {})
    const association = await getActiveAssociationBySlug(parsed.association)
    if (!association) {
      throw new ConsequenceError('Association invalide')
    }
    return parsed
  },

  async estimate(config: DonationConfig, amount: number) {
    const association = await getActiveAssociationBySlug(config.association)
    const label = association?.name ?? config.association
    return {
      label: `Don de ${formatEuroAmount(amount)}`,
      description: `Un prélèvement de ${formatEuroAmount(amount)} sera effectué et cumulé dans la cagnotte de ${label}.`,
    }
  },

  async execute(payload) {
    const payment = await chargeUserForConsequence('donation', payload)
    const donation = await processDonationExecution({
      userId: payload.userId,
      association: payload.config.association,
      amountCents: payload.amount,
      historyId: payload.historyId,
      paymentIntentId: payment.paymentIntentId,
    })

    return {
      status: 'accumulated',
      association: payload.config.association,
      associationLabel: donation.associationLabel,
      amountCents: payload.amount,
      currency: 'EUR',
      paymentIntentId: payment.paymentIntentId,
      donationExecutionId: donation.executionId,
      recordId: payment.recordId,
      alreadyProcessed: donation.alreadyProcessed,
    }
  },
}
