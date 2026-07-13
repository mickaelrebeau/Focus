import { chargeUserForConsequence } from '../../utils/consequence-payment'
import {
  stripeConfigSchema,
  type ConsequenceProvider,
  type StripeConfig,
  formatEuroAmount,
} from '../types'

export const stripeProvider: ConsequenceProvider<StripeConfig> = {
  type: 'stripe',

  async validate(config: unknown): Promise<StripeConfig> {
    return stripeConfigSchema.parse(config ?? {})
  },

  async estimate(_config: StripeConfig, amount: number) {
    return {
      label: `Prélèvement de ${formatEuroAmount(amount)}`,
      description: `Un prélèvement de ${formatEuroAmount(amount)} sera effectué sur votre carte enregistrée.`,
    }
  },

  async execute(payload) {
    const payment = await chargeUserForConsequence('stripe', payload)

    return {
      status: 'succeeded',
      paymentIntentId: payment.paymentIntentId,
      amountCents: payload.amount,
      currency: 'EUR',
      recordId: payment.recordId,
    }
  },
}
