import { asc, eq } from 'drizzle-orm'
import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { useDatabase, schema } from '../../database'

export default defineEventHandler(async (event) => {
  requireAuth(await getUserFromEvent(event))
  const db = useDatabase()

  const types = await db
    .select()
    .from(schema.consequenceTypes)
    .where(eq(schema.consequenceTypes.enabled, true))
    .orderBy(asc(schema.consequenceTypes.key))

  return { types }
})
