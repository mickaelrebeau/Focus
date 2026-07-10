import { eq, desc } from 'drizzle-orm'
import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { useDatabase, schema } from '../../database'
import { calculateNetScore } from '../../utils/credits'

export default defineEventHandler(async (event) => {
  requireAuth(await getUserFromEvent(event))
  const db = useDatabase()

  const wallets = await db
    .select({
      displayName: schema.users.displayName,
      balance: schema.wallets.balance,
      debt: schema.wallets.debt,
      leaderboardOptIn: schema.users.leaderboardOptIn,
    })
    .from(schema.wallets)
    .innerJoin(schema.users, eq(schema.wallets.userId, schema.users.id))
    .where(eq(schema.users.isBlocked, false))

  const leaderboard = wallets
    .filter(w => w.leaderboardOptIn)
    .map(w => ({
      displayName: w.displayName,
      balance: w.balance,
      debt: w.debt,
      netScore: calculateNetScore(w.balance, w.debt),
    }))
    .sort((a, b) => b.netScore - a.netScore)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))

  return { leaderboard }
})
