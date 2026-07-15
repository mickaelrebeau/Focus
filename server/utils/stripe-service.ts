import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'
import { useDatabase, schema } from '../database'
import { getStripe } from './stripe-client'

export interface StripePaymentMethodSummary {
  id: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

export async function ensureStripeCustomer(userId: string): Promise<string> {
  const db = useDatabase()
  const stripe = getStripe()

  const [user] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      displayName: schema.users.displayName,
      stripeCustomerId: schema.users.stripeCustomerId,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)

  if (!user) {
    throw new Error('Utilisateur introuvable')
  }

  if (user.stripeCustomerId) {
    return user.stripeCustomerId
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.displayName,
    metadata: { userId: user.id },
  })

  await db
    .update(schema.users)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(schema.users.id, userId))

  return customer.id
}

export async function createStripeSetupIntent(userId: string) {
  const stripe = getStripe()
  const customerId = await ensureStripeCustomer(userId)

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    usage: 'off_session',
    automatic_payment_methods: { enabled: true },
    metadata: { userId },
  })

  if (!setupIntent.client_secret) {
    throw new Error('SetupIntent sans client_secret')
  }

  return {
    clientSecret: setupIntent.client_secret,
    customerId,
  }
}

export async function getStripePaymentMethodSummary(
  userId: string,
  paymentMethodId: string,
): Promise<StripePaymentMethodSummary | null> {
  const stripe = getStripe()
  const customerId = await ensureStripeCustomer(userId)

  try {
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)
    if (paymentMethod.customer !== customerId) {
      return null
    }

    const card = paymentMethod.card
    if (!card) return null

    return {
      id: paymentMethod.id,
      brand: card.brand,
      last4: card.last4,
      expMonth: card.exp_month,
      expYear: card.exp_year,
    }
  } catch {
    return null
  }
}

export async function validateStripePaymentMethod(
  userId: string,
  paymentMethodId: string,
): Promise<{ customerId: string, paymentMethodId: string }> {
  const customerId = await ensureStripeCustomer(userId)
  const summary = await getStripePaymentMethodSummary(userId, paymentMethodId)

  if (!summary) {
    throw new Error('Moyen de paiement invalide ou non associé à votre compte')
  }

  const stripe = getStripe()
  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  })

  return { customerId, paymentMethodId }
}

interface OffSessionPaymentInput {
  userId: string
  customerId: string
  paymentMethodId: string
  amountCents: number
  historyId: string
  goalId: string
  occurrenceId: string
  provider?: string
}

export async function createOffSessionStripePayment(input: OffSessionPaymentInput) {
  const stripe = getStripe()
  const db = useDatabase()

  const paymentIntent = await stripe.paymentIntents.create({
    amount: input.amountCents,
    currency: 'eur',
    customer: input.customerId,
    payment_method: input.paymentMethodId,
    off_session: true,
    confirm: true,
    metadata: {
      userId: input.userId,
      goalId: input.goalId,
      occurrenceId: input.occurrenceId,
      historyId: input.historyId,
      provider: input.provider ?? 'stripe',
    },
  }, {
    idempotencyKey: `consequence-${input.historyId}`,
  })

  const [record] = await db.insert(schema.stripePayments).values({
    userId: input.userId,
    consequenceHistoryId: input.historyId,
    paymentIntentId: paymentIntent.id,
    amount: input.amountCents,
    currency: 'EUR',
    status: paymentIntent.status,
    metadata: {
      goalId: input.goalId,
      occurrenceId: input.occurrenceId,
    },
  }).onConflictDoNothing().returning()

  return {
    paymentIntentId: paymentIntent.id,
    status: paymentIntent.status,
    recordId: record?.id ?? null,
  }
}

export async function syncStripePaymentFromIntent(paymentIntent: Stripe.PaymentIntent) {
  const db = useDatabase()
  const historyId = paymentIntent.metadata.historyId

  await db
    .insert(schema.stripePayments)
    .values({
      userId: paymentIntent.metadata.userId!,
      consequenceHistoryId: historyId || null,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency.toUpperCase(),
      status: paymentIntent.status,
      metadata: paymentIntent.metadata,
    })
    .onConflictDoUpdate({
      target: schema.stripePayments.paymentIntentId,
      set: {
        status: paymentIntent.status,
        metadata: paymentIntent.metadata,
      },
    })

  if (!historyId) return

  if (paymentIntent.status === 'succeeded') {
    await db
      .update(schema.consequenceHistory)
      .set({
        status: 'completed',
        executedAt: new Date(),
        metadata: {
          config: {},
          result: {
            status: 'succeeded',
            paymentIntentId: paymentIntent.id,
            amountCents: paymentIntent.amount,
            currency: paymentIntent.currency,
          },
        },
      })
      .where(eq(schema.consequenceHistory.id, historyId))
  }

  if (paymentIntent.status === 'requires_payment_method' || paymentIntent.status === 'canceled') {
    await db
      .update(schema.consequenceHistory)
      .set({
        status: 'failed',
        executedAt: new Date(),
        metadata: {
          error: `Paiement Stripe ${paymentIntent.status}`,
          paymentIntentId: paymentIntent.id,
        },
      })
      .where(eq(schema.consequenceHistory.id, historyId))
  }
}
