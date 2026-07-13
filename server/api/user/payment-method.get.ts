import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { isStripeConfigured } from '../../utils/stripe-client'
import { getUserPaymentMethodSummary } from '../../utils/user-payment-method'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))

  if (!isStripeConfigured()) {
    return { configured: false, summary: null }
  }

  const summary = await getUserPaymentMethodSummary(user.id)

  return {
    configured: Boolean(summary),
    summary,
  }
})
