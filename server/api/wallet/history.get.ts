import { eq, desc } from 'drizzle-orm'
import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { useDatabase, schema } from '../../database'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const db = useDatabase()

  const entries = await db
    .select()
    .from(schema.creditLedger)
    .where(eq(schema.creditLedger.userId, user.id))
    .orderBy(desc(schema.creditLedger.createdAt))
    .limit(50)

  return { entries }
})
