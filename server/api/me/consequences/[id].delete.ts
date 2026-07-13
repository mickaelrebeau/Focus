import { and, eq } from 'drizzle-orm'
import { getUserFromEvent, requireAuth } from '../../../utils/auth'
import { useDatabase, schema } from '../../../database'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID requis' })

  const db = useDatabase()

  const [existing] = await db
    .select({ id: schema.userConsequences.id })
    .from(schema.userConsequences)
    .where(and(
      eq(schema.userConsequences.id, id),
      eq(schema.userConsequences.userId, user.id),
    ))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Conséquence introuvable' })
  }

  await db
    .delete(schema.userConsequences)
    .where(eq(schema.userConsequences.id, id))

  return { success: true }
})
