import { getStripe } from '../../utils/stripe-client'
import { syncStripePaymentFromIntent } from '../../utils/stripe-service'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const webhookSecret = config.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    throw createError({ statusCode: 503, message: 'Webhook Stripe non configuré' })
  }

  const signature = getHeader(event, 'stripe-signature')
  if (!signature) {
    throw createError({ statusCode: 400, message: 'Signature Stripe manquante' })
  }

  const rawBody = await readRawBody(event, 'utf8')
  if (!rawBody) {
    throw createError({ statusCode: 400, message: 'Corps de requête vide' })
  }

  const stripe = getStripe()
  let stripeEvent

  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Signature invalide'
    throw createError({ statusCode: 400, message })
  }

  switch (stripeEvent.type) {
    case 'payment_intent.succeeded':
    case 'payment_intent.payment_failed':
      await syncStripePaymentFromIntent(stripeEvent.data.object)
      break
    default:
      break
  }

  return { received: true }
})
