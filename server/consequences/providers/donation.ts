import { ConsequenceError } from '../errors'
import {
  donationConfigSchema,
  DONATION_ASSOCIATIONS,
  type ConsequenceProvider,
  type DonationConfig,
  formatEuroAmount,
} from '../types'
import { chargeUserForConsequence } from '../../utils/consequence-payment'
import { processDonationExecution } from '../../utils/donation-service'

export const donationProvider: ConsequenceProvider<DonationConfig> = {
  type: 'donation',

  async validate(config: unknown): Promise<DonationConfig> {
    const parsed = donationConfigSchema.parse(config ?? {})
    const validAssociation = DONATION_ASSOCIATIONS.some(a => a.value === parsed.association)
    if (!validAssociation) {
      throw new ConsequenceError('Association invalide')
    }
    return parsed
  },

  async estimate(config: DonationConfig, amount: number) {
    const association = DONATION_ASSOCIATIONS.find(a => a.value === config.association)
    const label = association?.label ?? config.association
    return {
      label: `Don de ${formatEuroAmount(amount)}`,
      description: `Un prélèvement de ${formatEuroAmount(amount)} sera effectué et reversé automatiquement à ${label}.`,
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
      status: donation.status === 'transferred' ? 'transferred' : 'succeeded',
      association: payload.config.association,
      associationLabel: donation.associationLabel,
      amountCents: payload.amount,
      currency: 'EUR',
      paymentIntentId: payment.paymentIntentId,
      donationExecutionId: donation.executionId,
      stripeTransferId: donation.stripeTransferId,
      recordId: payment.recordId,
    }
  },
}
