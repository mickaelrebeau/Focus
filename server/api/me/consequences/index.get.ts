import { asc, eq } from 'drizzle-orm'
import { getUserFromEvent, requireAuth } from '../../../utils/auth'
import { useDatabase, schema } from '../../../database'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const db = useDatabase()

  const consequences = await db
    .select()
    .from(schema.userConsequences)
    .where(eq(schema.userConsequences.userId, user.id))
    .orderBy(asc(schema.userConsequences.priority))

  return { consequences }
})
