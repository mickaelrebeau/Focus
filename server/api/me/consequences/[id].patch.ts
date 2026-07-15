import { and, eq } from 'drizzle-orm'
import { getUserFromEvent, requireAuth } from '../../../utils/auth'
import { parseBody } from '../../../utils/validation'
import { updateUserConsequenceSchema } from '../../../consequences/schemas'
import { useDatabase, schema } from '../../../database'
import { toHttpError } from '../../../consequences/errors'
import {
  validateConsequenceAmount,
  validateUserConsequenceInput,
} from '../../../utils/consequences-service'
import { assertPaymentMethodForMonetaryConsequence } from '../../../utils/user-payment-method'
import type { ConsequenceProviderKey } from '../../../consequences/types'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID requis' })

  const body = await readBody(event)
  const data = parseBody(updateUserConsequenceSchema, body)
  const db = useDatabase()

  const [existing] = await db
    .select()
    .from(schema.userConsequences)
    .where(and(
      eq(schema.userConsequences.id, id),
      eq(schema.userConsequences.userId, user.id),
    ))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Conséquence introuvable' })
  }

  const nextAmount = data.amount ?? existing.amount
  const nextConfig = data.config ?? existing.config
  const type = existing.type as ConsequenceProviderKey

  if (data.amount !== undefined) {
    try {
      validateConsequenceAmount(type, nextAmount)
    } catch (error) {
      toHttpError(error)
    }
  }

  let validatedConfig = existing.config as Record<string, unknown>
  if (data.config !== undefined) {
    validatedConfig = await validateUserConsequenceInput(type, nextAmount, nextConfig)
  }

  const nextEnabled = data.enabled ?? existing.enabled

  try {
    await assertPaymentMethodForMonetaryConsequence(user.id, type, nextEnabled)
  } catch (error) {
    toHttpError(error)
  }

  const [consequence] = await db
    .update(schema.userConsequences)
    .set({
      enabled: nextEnabled,
      amount: nextAmount,
      priority: data.priority ?? existing.priority,
      config: data.config !== undefined ? validatedConfig : existing.config,
      updatedAt: new Date(),
    })
    .where(eq(schema.userConsequences.id, id))
    .returning()

  return { consequence }
})
