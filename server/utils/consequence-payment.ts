import type { ConsequenceExecutionPayload, ConsequenceProviderKey } from '../consequences/types'
import { isStripeConfigured } from './stripe-client'
import { createOffSessionStripePayment } from './stripe-service'
import { getUserPaymentMethodCredentials } from './user-payment-method'

export interface ConsequencePaymentResult {
  paymentIntentId: string
  status: string
  recordId: string | null
}

export async function chargeUserForConsequence(
  provider: ConsequenceProviderKey,
  payload: ConsequenceExecutionPayload,
): Promise<ConsequencePaymentResult> {
  if (!isStripeConfigured()) {
    throw new Error('Stripe n\'est pas configuré sur ce serveur')
  }

  const credentials = await getUserPaymentMethodCredentials(payload.userId)
  if (!credentials) {
    throw new Error('Moyen de paiement non configuré')
  }

  const result = await createOffSessionStripePayment({
    userId: payload.userId,
    customerId: credentials.customerId,
    paymentMethodId: credentials.paymentMethodId,
    amountCents: payload.amount,
    historyId: payload.historyId,
    goalId: payload.goalId,
    occurrenceId: payload.occurrenceId,
    provider,
  })

  if (result.status !== 'succeeded') {
    throw new Error(`Paiement non confirmé (${result.status})`)
  }

  return result
}
