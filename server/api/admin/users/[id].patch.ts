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

  // Compte supprimé par son titulaire : le débloquer le rendrait de nouveau actif
  const [target] = await db
    .select({ deletedAt: schema.users.deletedAt })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)
  if (target?.deletedAt && body.isBlocked === false) {
    throw createError({ statusCode: 409, message: 'Compte supprimé : il ne peut pas être débloqué' })
  }

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
