import { eq, desc } from 'drizzle-orm'
import { getUserFromEvent, requireAuth, requireAdmin } from '../../utils/auth'
import { useDatabase, schema } from '../../database'

export default defineEventHandler(async (event) => {
  requireAdmin(requireAuth(await getUserFromEvent(event)))
  const db = useDatabase()

  const logs = await db
    .select({
      log: schema.auditLogs,
      actor: schema.users,
    })
    .from(schema.auditLogs)
    .leftJoin(schema.users, eq(schema.auditLogs.actorId, schema.users.id))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(100)

  return {
    logs: logs.map(({ log, actor }) => ({
      ...log,
      actor: actor ? { id: actor.id, displayName: actor.displayName, email: actor.email } : null,
    })),
  }
})
