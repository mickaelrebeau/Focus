import { eq } from 'drizzle-orm'
import { getUserFromEvent, requireAuth, requireAdmin } from '../../../utils/auth'
import { useDatabase, schema } from '../../../database'
import { logAudit } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(requireAuth(await getUserFromEvent(event)))
  const userId = getRouterParam(event, 'id')
  if (!userId) throw createError({ statusCode: 400, message: 'ID requis' })

  const db = useDatabase()

  const body = await readBody(event)
  const [updated] = await db
    .update(schema.users)
    .set({
      isBlocked: body.isBlocked,
      role: body.role,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, userId))
    .returning()

  await logAudit(admin.id, 'user.update', 'user', userId, body, getRequestIP(event) ?? undefined)
  return { user: updated }
})
