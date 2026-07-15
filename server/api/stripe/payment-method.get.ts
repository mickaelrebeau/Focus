import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { isStripeConfigured } from '../../utils/stripe-client'
import { getStripePaymentMethodSummary } from '../../utils/stripe-service'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const paymentMethodId = getQuery(event).paymentMethodId

  if (!paymentMethodId || typeof paymentMethodId !== 'string') {
    throw createError({ statusCode: 400, message: 'paymentMethodId requis' })
  }

  if (!isStripeConfigured()) {
    throw createError({ statusCode: 503, message: 'Stripe n\'est pas configuré' })
  }

  const summary = await getStripePaymentMethodSummary(user.id, paymentMethodId)

  return { summary }
})
