import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { useDatabase, schema } from '../database'
import { listActiveAssociations, listAllAssociations } from './associations'

export interface AssociationPotStats {
  slug: string
  name: string
  description: string | null
  logoUrl: string | null
  collectedCents: number
  paidOutCents: number
  balanceCents: number
  monthCents: number
  contributionCount: number
}

export interface AssociationPotPayoutSummary {
  id: string
  associationSlug: string
  period: string
  amount: number
  notes: string | null
  createdAt: Date
}

function getMonthStart(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

async function getCollectedByAssociation(slugs: string[]) {
  if (slugs.length === 0) return new Map<string, { total: number, month: number, count: number }>()

  const db = useDatabase()
  const monthStart = getMonthStart()

  const totals = await db
    .select({
      association: schema.donationExecutions.association,
      total: sql<number>`coalesce(sum(${schema.donationExecutions.amount}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.donationExecutions)
    .where(and(
      inArray(schema.donationExecutions.association, slugs),
      eq(schema.donationExecutions.status, 'accumulated'),
    ))
    .groupBy(schema.donationExecutions.association)

  const monthTotals = await db
    .select({
      association: schema.donationExecutions.association,
      monthCents: sql<number>`coalesce(sum(${schema.donationExecutions.amount}), 0)::int`,
    })
    .from(schema.donationExecutions)
    .where(and(
      inArray(schema.donationExecutions.association, slugs),
      eq(schema.donationExecutions.status, 'accumulated'),
      gte(schema.donationExecutions.createdAt, monthStart),
    ))
    .groupBy(schema.donationExecutions.association)

  const map = new Map<string, { total: number, month: number, count: number }>()
  for (const slug of slugs) {
    map.set(slug, { total: 0, month: 0, count: 0 })
  }
  for (const row of totals) {
    map.set(row.association, {
      total: row.total ?? 0,
      month: map.get(row.association)?.month ?? 0,
      count: row.count ?? 0,
    })
  }
  for (const row of monthTotals) {
    const current = map.get(row.association) ?? { total: 0, month: 0, count: 0 }
    map.set(row.association, { ...current, month: row.monthCents ?? 0 })
  }

  return map
}

async function getPaidOutByAssociation(slugs: string[]) {
  if (slugs.length === 0) return new Map<string, number>()

  const db = useDatabase()
  const payouts = await db
    .select({
      associationSlug: schema.associationPotPayouts.associationSlug,
      paidOut: sql<number>`coalesce(sum(${schema.associationPotPayouts.amount}), 0)::int`,
    })
    .from(schema.associationPotPayouts)
    .where(inArray(schema.associationPotPayouts.associationSlug, slugs))
    .groupBy(schema.associationPotPayouts.associationSlug)

  const map = new Map<string, number>()
  for (const slug of slugs) {
    map.set(slug, 0)
  }
  for (const row of payouts) {
    map.set(row.associationSlug, row.paidOut ?? 0)
  }

  return map
}

export async function getAssociationPotStatsForSlug(slug: string): Promise<AssociationPotStats | null> {
  const db = useDatabase()
  const [association] = await db
    .select()
    .from(schema.associations)
    .where(eq(schema.associations.slug, slug))
    .limit(1)

  if (!association) return null

  const collected = await getCollectedByAssociation([slug])
  const paidOut = await getPaidOutByAssociation([slug])
  const collectedStats = collected.get(slug) ?? { total: 0, month: 0, count: 0 }
  const paidOutCents = paidOut.get(slug) ?? 0

  return {
    slug: association.slug,
    name: association.name,
    description: association.description,
    logoUrl: association.logoUrl,
    collectedCents: collectedStats.total,
    paidOutCents,
    balanceCents: Math.max(0, collectedStats.total - paidOutCents),
    monthCents: collectedStats.month,
    contributionCount: collectedStats.count,
  }
}

export async function getPublicAssociationPots(): Promise<AssociationPotStats[]> {
  const associations = await listActiveAssociations()
  const slugs = associations.map(item => item.slug)
  const collected = await getCollectedByAssociation(slugs)
  const paidOut = await getPaidOutByAssociation(slugs)

  return associations.map((association) => {
    const collectedStats = collected.get(association.slug) ?? { total: 0, month: 0, count: 0 }
    const paidOutCents = paidOut.get(association.slug) ?? 0

    return {
      slug: association.slug,
      name: association.name,
      description: association.description,
      logoUrl: association.logoUrl,
      collectedCents: collectedStats.total,
      paidOutCents,
      balanceCents: Math.max(0, collectedStats.total - paidOutCents),
      monthCents: collectedStats.month,
      contributionCount: collectedStats.count,
    }
  })
}

export async function getAdminAssociationPots() {
  const associations = await listAllAssociations()
  const slugs = associations.map(item => item.slug)
  const collected = await getCollectedByAssociation(slugs)
  const paidOut = await getPaidOutByAssociation(slugs)

  return associations.map((association) => {
    const collectedStats = collected.get(association.slug) ?? { total: 0, month: 0, count: 0 }
    const paidOutCents = paidOut.get(association.slug) ?? 0

    return {
      ...association,
      collectedCents: collectedStats.total,
      paidOutCents,
      balanceCents: Math.max(0, collectedStats.total - paidOutCents),
      monthCents: collectedStats.month,
      contributionCount: collectedStats.count,
    }
  })
}

export async function getAssociationPayoutHistory(slug?: string, limit = 50): Promise<AssociationPotPayoutSummary[]> {
  const db = useDatabase()

  const baseQuery = db
    .select({
      id: schema.associationPotPayouts.id,
      associationSlug: schema.associationPotPayouts.associationSlug,
      period: schema.associationPotPayouts.period,
      amount: schema.associationPotPayouts.amount,
      notes: schema.associationPotPayouts.notes,
      createdAt: schema.associationPotPayouts.createdAt,
    })
    .from(schema.associationPotPayouts)

  const rows = slug
    ? await baseQuery
      .where(eq(schema.associationPotPayouts.associationSlug, slug))
      .orderBy(desc(schema.associationPotPayouts.createdAt))
      .limit(limit)
    : await baseQuery
      .orderBy(desc(schema.associationPotPayouts.createdAt))
      .limit(limit)

  return rows
}

export async function recordAssociationPayout(input: {
  associationSlug: string
  period: string
  amountCents: number
  adminId: string
  notes?: string
}) {
  const stats = await getAssociationPotStatsForSlug(input.associationSlug)
  if (!stats) {
    throw new Error('Association introuvable')
  }

  if (input.amountCents <= 0) {
    throw new Error('Le montant doit être positif')
  }

  if (input.amountCents > stats.balanceCents) {
    throw new Error(`Le montant dépasse le solde disponible (${stats.balanceCents} centimes)`)
  }

  const db = useDatabase()
  const [payout] = await db.insert(schema.associationPotPayouts).values({
    associationSlug: input.associationSlug,
    period: input.period,
    amount: input.amountCents,
    adminId: input.adminId,
    notes: input.notes,
  }).returning()

  return payout
}
