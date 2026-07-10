import { eq, count, sql, desc } from 'drizzle-orm'
import { getUserFromEvent, requireAuth, requireAdmin } from '../../utils/auth'
import { useDatabase, schema } from '../../database'

export default defineEventHandler(async (event) => {
  const user = requireAdmin(requireAuth(await getUserFromEvent(event)))
  const db = useDatabase()

  const [userCount] = await db.select({ count: count() }).from(schema.users)
  const [goalCount] = await db.select({ count: count() }).from(schema.goals).where(eq(schema.goals.isActive, true))
  const [pendingValidations] = await db.select({ count: count() }).from(schema.validations).where(eq(schema.validations.status, 'pending_review'))
  const [failedToday] = await db.select({ count: count() }).from(schema.occurrences).where(eq(schema.occurrences.status, 'failed'))

  const [totalCredits] = await db.select({
    total: sql<number>`coalesce(sum(${schema.wallets.balance}), 0)`,
    totalDebt: sql<number>`coalesce(sum(${schema.wallets.debt}), 0)`,
  }).from(schema.wallets)

  return {
    stats: {
      users: userCount.count,
      activeGoals: goalCount.count,
      pendingValidations: pendingValidations.count,
      failedOccurrences: failedToday.count,
      totalCredits: Number(totalCredits.total),
      totalDebt: Number(totalCredits.totalDebt),
    },
  }
})
