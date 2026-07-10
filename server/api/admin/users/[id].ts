import { eq } from 'drizzle-orm'
import { getUserFromEvent, requireAuth, requireAdmin } from '../../../utils/auth'
import { useDatabase, schema } from '../../../database'
import { adminAdjustSchema, parseBody } from '../../../utils/validation'
import { adminAdjustCredits } from '../../../utils/credits'
import { logAudit } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(requireAuth(await getUserFromEvent(event)))
  const userId = getRouterParam(event, 'id')
  if (!userId) throw createError({ statusCode: 400, message: 'ID requis' })

  const db = useDatabase()

  if (event.method === 'GET') {
    const [user] = await db
      .select({
        user: schema.users,
        wallet: schema.wallets,
      })
      .from(schema.users)
      .leftJoin(schema.wallets, eq(schema.users.id, schema.wallets.userId))
      .where(eq(schema.users.id, userId))
      .limit(1)

    if (!user) throw createError({ statusCode: 404, message: 'Utilisateur introuvable' })

    const goals = await db.select().from(schema.goals).where(eq(schema.goals.userId, userId))
    const ledger = await db
      .select()
      .from(schema.creditLedger)
      .where(eq(schema.creditLedger.userId, userId))
      .orderBy(schema.creditLedger.createdAt)
      .limit(20)

    return {
      user: {
        ...user.user,
        balance: user.wallet?.balance ?? 0,
        debt: user.wallet?.debt ?? 0,
      },
      goals,
      ledger,
    }
  }

  if (event.method === 'PATCH') {
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
  }

  if (event.method === 'POST') {
    const body = await readBody(event)
    const data = parseBody(adminAdjustSchema, body)

    const result = await adminAdjustCredits(userId, data.amount, admin.id, data.reason)
    await logAudit(admin.id, 'credits.adjust', 'user', userId, data, getRequestIP(event) ?? undefined)

    return result
  }
})
