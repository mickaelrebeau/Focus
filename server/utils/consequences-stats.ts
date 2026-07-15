import { and, eq, sql } from 'drizzle-orm'
import { useDatabase, schema } from '../database'
import { isMonetaryProvider, type ConsequenceProviderKey } from '../consequences/types'

export interface ConsequenceStats {
  totalConfigured: number
  totalExecuted: number
  moneyCommittedCents: number
  moneyDonatedCents: number
  creditsLost: number
}

export type ConsequenceStatKey = keyof ConsequenceStats

const STAT_KEYS: ConsequenceStatKey[] = [
  'totalConfigured',
  'totalExecuted',
  'moneyCommittedCents',
  'moneyDonatedCents',
  'creditsLost',
]

export function buildConsequenceStatsRecord(stats: ConsequenceStats): Record<ConsequenceStatKey, number> {
  return STAT_KEYS.reduce((record, key) => {
    record[key] = stats[key]
    return record
  }, {} as Record<ConsequenceStatKey, number>)
}

export async function getConsequenceStatsForUser(userId: string): Promise<ConsequenceStats> {
  const db = useDatabase()

  const [configured] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.userConsequences)
    .where(eq(schema.userConsequences.userId, userId))

  const [executed] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.consequenceHistory)
    .where(and(
      eq(schema.consequenceHistory.userId, userId),
      eq(schema.consequenceHistory.status, 'completed'),
    ))

  const completedHistory = await db
    .select({
      provider: schema.consequenceHistory.provider,
      amount: schema.consequenceHistory.amount,
      metadata: schema.consequenceHistory.metadata,
    })
    .from(schema.consequenceHistory)
    .where(and(
      eq(schema.consequenceHistory.userId, userId),
      eq(schema.consequenceHistory.status, 'completed'),
    ))

  let moneyCommittedCents = 0
  let moneyDonatedCents = 0
  let creditsLost = 0

  for (const entry of completedHistory) {
    const provider = entry.provider as ConsequenceProviderKey

    if (provider === 'credits') {
      creditsLost += entry.amount
      continue
    }

    if (isMonetaryProvider(provider)) {
      moneyCommittedCents += entry.amount
    }

    if (provider === 'donation') {
      const result = entry.metadata?.result as Record<string, unknown> | undefined
      if (result?.donationExecutionId || result?.status === 'accumulated') {
        moneyDonatedCents += entry.amount
      }
    }
  }

  return {
    totalConfigured: configured?.count ?? 0,
    totalExecuted: executed?.count ?? 0,
    moneyCommittedCents,
    moneyDonatedCents,
    creditsLost,
  }
}
