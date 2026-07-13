import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getUserFromEvent, requireAuth, requireAdmin } from '../../../utils/auth'
import { parseBody } from '../../../utils/validation'
import { useDatabase, schema } from '../../../database'
import { DONATION_ASSOCIATIONS } from '../../../consequences/types'

const settingsSchema = z.object({
  monthlyGoalCents: z.number().int().min(100),
  targetAssociation: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  requireAdmin(requireAuth(await getUserFromEvent(event)))
  const body = await readBody(event)
  const data = parseBody(settingsSchema, body)

  const validAssociation = DONATION_ASSOCIATIONS.some(item => item.value === data.targetAssociation)
  if (!validAssociation) {
    throw createError({ statusCode: 400, message: 'Association invalide' })
  }

  const db = useDatabase()
  const [settings] = await db
    .update(schema.communityPotSettings)
    .set({
      monthlyGoalCents: data.monthlyGoalCents,
      targetAssociation: data.targetAssociation,
      updatedAt: new Date(),
    })
    .where(eq(schema.communityPotSettings.id, 'default'))
    .returning()

  return { settings }
})
