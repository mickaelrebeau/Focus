import { eq, desc, ilike, or, and } from 'drizzle-orm'
import { getUserFromEvent, requireAuth, requireAdmin } from '../../../utils/auth'
import { useDatabase, schema } from '../../../database'

export default defineEventHandler(async (event) => {
  requireAdmin(requireAuth(await getUserFromEvent(event)))
  const query = getQuery(event)
  const search = (query.search as string) ?? ''
  const db = useDatabase()

  const conditions = search
    ? or(
        ilike(schema.users.email, `%${search}%`),
        ilike(schema.users.displayName, `%${search}%`),
      )
    : undefined

  const users = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      displayName: schema.users.displayName,
      role: schema.users.role,
      isBlocked: schema.users.isBlocked,
      createdAt: schema.users.createdAt,
      balance: schema.wallets.balance,
      debt: schema.wallets.debt,
    })
    .from(schema.users)
    .leftJoin(schema.wallets, eq(schema.users.id, schema.wallets.userId))
    .where(conditions)
    .orderBy(desc(schema.users.createdAt))
    .limit(50)

  return {
    users: users.map(u => ({
      ...u,
      netScore: (u.balance ?? 0) - (u.debt ?? 0),
    })),
  }
})
