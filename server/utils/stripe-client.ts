import Stripe from 'stripe'

let stripeClient: Stripe | null = null

function getStripeSecretKey(): string {
  if (process.env.STRIPE_SECRET_KEY) {
    return process.env.STRIPE_SECRET_KEY
  }

  try {
    const config = useRuntimeConfig()
    if (config.stripeSecretKey) {
      return config.stripeSecretKey
    }
  } catch {
    // Hors contexte Nitro
  }

  throw new Error('STRIPE_SECRET_KEY non configurée')
}

export function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(getStripeSecretKey())
  }
  return stripeClient
}

export function isStripeConfigured(): boolean {
  try {
    getStripeSecretKey()
    return true
  } catch {
    return false
  }
}
