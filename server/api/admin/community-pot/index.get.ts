import { eq, desc } from 'drizzle-orm'
import { getUserFromEvent, requireAuth, requireAdmin } from '../../../utils/auth'
import { useDatabase, schema } from '../../../database'
import { getCommunityPotStats, getCommunityPotSettings } from '../../../utils/community-pot'
import { listActiveAssociations } from '../../../utils/associations'

export default defineEventHandler(async (event) => {
  requireAdmin(requireAuth(await getUserFromEvent(event)))

  const stats = await getCommunityPotStats()
  const settings = await getCommunityPotSettings()
  const db = useDatabase()

  const payouts = await db
    .select()
    .from(schema.communityPotPayouts)
    .orderBy(desc(schema.communityPotPayouts.createdAt))
    .limit(20)

  const recentTransactions = await db
    .select({
      id: schema.communityPotTransactions.id,
      amount: schema.communityPotTransactions.amount,
      createdAt: schema.communityPotTransactions.createdAt,
      userId: schema.communityPotTransactions.userId,
      displayName: schema.users.displayName,
    })
    .from(schema.communityPotTransactions)
    .innerJoin(schema.users, eq(schema.users.id, schema.communityPotTransactions.userId))
    .orderBy(desc(schema.communityPotTransactions.createdAt))
    .limit(20)

  const associations = await listActiveAssociations()

  return {
    stats,
    settings,
    associations: associations.map(item => ({ value: item.slug, label: item.name })),
    payouts,
    recentTransactions,
  }
})
