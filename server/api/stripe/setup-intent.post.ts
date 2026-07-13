import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { isStripeConfigured } from '../../utils/stripe-client'
import { createStripeSetupIntent } from '../../utils/stripe-service'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))

  if (!isStripeConfigured()) {
    throw createError({ statusCode: 503, message: 'Stripe n\'est pas configuré' })
  }

  const result = await createStripeSetupIntent(user.id)

  return result
})
