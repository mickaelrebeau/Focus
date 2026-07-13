import { gte, sql } from 'drizzle-orm'
import { useDatabase, schema } from '../database'
import { DONATION_ASSOCIATIONS } from '#shared/donation-associations'

export interface CommunityPotStats {
  balanceCents: number
  monthCents: number
  monthlyGoalCents: number
  targetAssociation: string
  targetAssociationLabel: string
  progressPercent: number
  transactionCount: number
}

function getMonthStart(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

function getAssociationLabel(value: string): string {
  return DONATION_ASSOCIATIONS.find(item => item.value === value)?.label ?? value
}

export async function getCommunityPotSettings() {
  const db = useDatabase()
  const [settings] = await db
    .select()
    .from(schema.communityPotSettings)
    .limit(1)

  if (settings) {
    return settings
  }

  const [created] = await db.insert(schema.communityPotSettings).values({
    id: 'default',
    monthlyGoalCents: 50000,
    targetAssociation: 'msf',
  }).returning()

  return created
}

export async function getCommunityPotStats(): Promise<CommunityPotStats> {
  const defaults: CommunityPotStats = {
    balanceCents: 0,
    monthCents: 0,
    monthlyGoalCents: 50000,
    targetAssociation: 'msf',
    targetAssociationLabel: getAssociationLabel('msf'),
    progressPercent: 0,
    transactionCount: 0,
  }

  try {
    const db = useDatabase()
    const settings = await getCommunityPotSettings()
    const monthStart = getMonthStart()

    const [totals] = await db
      .select({
        contributed: sql<number>`coalesce(sum(${schema.communityPotTransactions.amount}), 0)::int`,
        transactionCount: sql<number>`count(*)::int`,
      })
      .from(schema.communityPotTransactions)

    const [payouts] = await db
      .select({
        paidOut: sql<number>`coalesce(sum(${schema.communityPotPayouts.amount}), 0)::int`,
      })
      .from(schema.communityPotPayouts)

    const [monthTotals] = await db
      .select({
        monthCents: sql<number>`coalesce(sum(${schema.communityPotTransactions.amount}), 0)::int`,
      })
      .from(schema.communityPotTransactions)
      .where(gte(schema.communityPotTransactions.createdAt, monthStart))

    const balanceCents = (totals?.contributed ?? 0) - (payouts?.paidOut ?? 0)
    const monthCents = monthTotals?.monthCents ?? 0
    const monthlyGoalCents = settings.monthlyGoalCents
    const progressPercent = monthlyGoalCents > 0
      ? Math.min(100, Math.round((monthCents / monthlyGoalCents) * 100))
      : 0

    return {
      balanceCents: Math.max(0, balanceCents),
      monthCents,
      monthlyGoalCents,
      targetAssociation: settings.targetAssociation,
      targetAssociationLabel: getAssociationLabel(settings.targetAssociation),
      progressPercent,
      transactionCount: totals?.transactionCount ?? 0,
    }
  } catch (error) {
    console.error('[CommunityPot] Stats indisponibles:', error)
    return defaults
  }
}
