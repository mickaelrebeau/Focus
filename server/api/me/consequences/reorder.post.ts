import { and, asc, eq } from 'drizzle-orm'
import { getUserFromEvent, requireAuth } from '../../../utils/auth'
import { parseBody } from '../../../utils/validation'
import { reorderConsequencesSchema } from '../../../consequences/schemas'
import { useDatabase, schema } from '../../../database'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const body = await readBody(event)
  const data = parseBody(reorderConsequencesSchema, body)
  const db = useDatabase()

  const existing = await db
    .select({ id: schema.userConsequences.id })
    .from(schema.userConsequences)
    .where(eq(schema.userConsequences.userId, user.id))

  const existingIds = new Set(existing.map(row => row.id))
  const orderedIds = data.orderedIds

  if (orderedIds.length !== existingIds.size) {
    throw createError({ statusCode: 400, message: 'Liste de réordonnancement incomplète' })
  }

  for (const id of orderedIds) {
    if (!existingIds.has(id)) {
      throw createError({ statusCode: 400, message: 'Conséquence invalide dans le réordonnancement' })
    }
  }

  await db.transaction(async (tx) => {
    for (let index = 0; index < orderedIds.length; index++) {
      const id = orderedIds[index]!
      await tx
        .update(schema.userConsequences)
        .set({ priority: index, updatedAt: new Date() })
        .where(and(
          eq(schema.userConsequences.id, id),
          eq(schema.userConsequences.userId, user.id),
        ))
    }
  })

  const consequences = await db
    .select()
    .from(schema.userConsequences)
    .where(eq(schema.userConsequences.userId, user.id))
    .orderBy(asc(schema.userConsequences.priority))

  return { consequences }
})
