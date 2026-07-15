import { eq } from 'drizzle-orm'
import { ConsequenceError } from '../consequences/errors'
import { isMonetaryProvider, type ConsequenceProviderKey } from '../consequences/types'
import { useDatabase, schema } from '../database'
import {
  ensureStripeCustomer,
  getStripePaymentMethodSummary,
  validateStripePaymentMethod,
  type StripePaymentMethodSummary,
} from './stripe-service'

export interface UserPaymentMethodSummary {
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

export function toUserPaymentMethodSummary(
  user: {
    stripePaymentMethodBrand: string | null
    stripePaymentMethodLast4: string | null
    stripePaymentMethodExpMonth: number | null
    stripePaymentMethodExpYear: number | null
  },
): UserPaymentMethodSummary | null {
  if (!user.stripePaymentMethodLast4 || !user.stripePaymentMethodBrand) {
    return null
  }

  return {
    brand: user.stripePaymentMethodBrand,
    last4: user.stripePaymentMethodLast4,
    expMonth: user.stripePaymentMethodExpMonth ?? 0,
    expYear: user.stripePaymentMethodExpYear ?? 0,
  }
}

export async function userHasPaymentMethod(userId: string): Promise<boolean> {
  const db = useDatabase()
  const [user] = await db
    .select({ stripePaymentMethodId: schema.users.stripePaymentMethodId })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)

  return Boolean(user?.stripePaymentMethodId)
}

export async function getUserPaymentMethodSummary(
  userId: string,
): Promise<UserPaymentMethodSummary | null> {
  const db = useDatabase()
  const [user] = await db
    .select({
      stripePaymentMethodBrand: schema.users.stripePaymentMethodBrand,
      stripePaymentMethodLast4: schema.users.stripePaymentMethodLast4,
      stripePaymentMethodExpMonth: schema.users.stripePaymentMethodExpMonth,
      stripePaymentMethodExpYear: schema.users.stripePaymentMethodExpYear,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)

  if (!user) return null
  return toUserPaymentMethodSummary(user)
}

export async function getUserPaymentMethodCredentials(
  userId: string,
): Promise<{ customerId: string, paymentMethodId: string } | null> {
  const db = useDatabase()
  const [user] = await db
    .select({
      stripeCustomerId: schema.users.stripeCustomerId,
      stripePaymentMethodId: schema.users.stripePaymentMethodId,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)

  if (!user?.stripePaymentMethodId) {
    return null
  }

  const customerId = user.stripeCustomerId ?? await ensureStripeCustomer(userId)

  return {
    customerId,
    paymentMethodId: user.stripePaymentMethodId,
  }
}

export async function saveUserPaymentMethod(
  userId: string,
  paymentMethodId: string,
): Promise<UserPaymentMethodSummary> {
  const validated = await validateStripePaymentMethod(userId, paymentMethodId)
  const summary = await getStripePaymentMethodSummary(userId, paymentMethodId)

  if (!summary) {
    throw new Error('Impossible de récupérer le moyen de paiement')
  }

  const db = useDatabase()
  await db
    .update(schema.users)
    .set({
      stripeCustomerId: validated.customerId,
      stripePaymentMethodId: validated.paymentMethodId,
      stripePaymentMethodBrand: summary.brand,
      stripePaymentMethodLast4: summary.last4,
      stripePaymentMethodExpMonth: summary.expMonth,
      stripePaymentMethodExpYear: summary.expYear,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, userId))

  return {
    brand: summary.brand,
    last4: summary.last4,
    expMonth: summary.expMonth,
    expYear: summary.expYear,
  }
}

export async function assertPaymentMethodForMonetaryConsequence(
  userId: string,
  type: ConsequenceProviderKey,
  enabled: boolean,
): Promise<void> {
  if (!enabled || !isMonetaryProvider(type)) {
    return
  }

  const hasPaymentMethod = await userHasPaymentMethod(userId)
  if (!hasPaymentMethod) {
    throw new ConsequenceError(
      'Configurez une carte bancaire dans vos réglages avant d\'activer cette conséquence',
    )
  }
}

export function enrichMonetaryEstimate(
  estimate: { label: string, description: string },
  summary: UserPaymentMethodSummary | StripePaymentMethodSummary,
): { label: string, description: string } {
  const brand = summary.brand.charAt(0).toUpperCase() + summary.brand.slice(1)
  const cardLabel = `${brand} •••• ${summary.last4}`

  return {
    label: estimate.label,
    description: `${estimate.description} Prélèvement sur ${cardLabel}.`,
  }
}
