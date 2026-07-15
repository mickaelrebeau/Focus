import { and, eq, sql } from 'drizzle-orm'
import { getUserFromEvent, requireAuth } from '../../../utils/auth'
import { parseBody } from '../../../utils/validation'
import { createUserConsequenceSchema } from '../../../consequences/schemas'
import { useDatabase, schema } from '../../../database'
import { toHttpError } from '../../../consequences/errors'
import { validateUserConsequenceInput } from '../../../utils/consequences-service'
import { assertPaymentMethodForMonetaryConsequence } from '../../../utils/user-payment-method'
import type { ConsequenceProviderKey } from '../../../consequences/types'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const body = await readBody(event)
  const data = parseBody(createUserConsequenceSchema, body)
  const db = useDatabase()

  const [typeRow] = await db
    .select()
    .from(schema.consequenceTypes)
    .where(eq(schema.consequenceTypes.key, data.type))
    .limit(1)

  if (!typeRow || !typeRow.enabled) {
    throw createError({ statusCode: 400, message: 'Type de conséquence indisponible' })
  }

  const [existing] = await db
    .select({ id: schema.userConsequences.id })
    .from(schema.userConsequences)
    .where(and(
      eq(schema.userConsequences.userId, user.id),
      eq(schema.userConsequences.type, data.type),
    ))
    .limit(1)

  if (existing) {
    throw createError({ statusCode: 409, message: 'Ce type de conséquence est déjà configuré' })
  }

  const type = data.type as ConsequenceProviderKey
  const config = await validateUserConsequenceInput(type, data.amount, data.config)

  try {
    await assertPaymentMethodForMonetaryConsequence(user.id, type, data.enabled ?? false)
  } catch (error) {
    toHttpError(error)
  }

  const [maxPriority] = await db
    .select({ max: sql<number>`coalesce(max(${schema.userConsequences.priority}), -1)` })
    .from(schema.userConsequences)
    .where(eq(schema.userConsequences.userId, user.id))

  const priority = data.priority ?? (maxPriority?.max ?? -1) + 1

  const [consequence] = await db.insert(schema.userConsequences).values({
    userId: user.id,
    type: data.type,
    enabled: data.enabled,
    amount: data.amount,
    priority,
    config,
  }).returning()

  return { consequence }
})
