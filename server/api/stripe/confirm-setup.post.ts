import { z } from 'zod'
import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { parseBody } from '../../utils/validation'
import { isStripeConfigured } from '../../utils/stripe-client'
import { saveUserPaymentMethod } from '../../utils/user-payment-method'

const confirmSetupSchema = z.object({
  paymentMethodId: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))

  if (!isStripeConfigured()) {
    throw createError({ statusCode: 503, message: 'Stripe n\'est pas configuré' })
  }

  const body = await readBody(event)
  const data = parseBody(confirmSetupSchema, body)
  const summary = await saveUserPaymentMethod(user.id, data.paymentMethodId)

  return { summary }
})
