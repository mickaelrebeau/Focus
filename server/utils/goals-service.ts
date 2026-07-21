import { eq, and, lte } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { useDatabase, schema } from '../database'
import { triggerConsequencesOnFailure } from './consequences-service'
import { processStreaksForUser, reevaluateUserDay } from './streaks'
import { acquireLock, releaseLock } from './redis'

type Db = PostgresJsDatabase<typeof schema>

type ExpiredOccurrenceRow = {
  occurrence: typeof schema.occurrences.$inferSelect
  goal: typeof schema.goals.$inferSelect
}

async function fetchExpiredOccurrences(db: Db, userId?: string, now = new Date()) {
  const conditions = [
    eq(schema.occurrences.status, 'pending'),
    lte(schema.occurrences.dueAt, now),
    eq(schema.goals.isActive, true),
  ]

  if (userId) {
    conditions.push(eq(schema.occurrences.userId, userId))
  }

  return db
    .select({
      occurrence: schema.occurrences,
      goal: schema.goals,
    })
    .from(schema.occurrences)
    .innerJoin(schema.goals, eq(schema.occurrences.goalId, schema.goals.id))
    .where(and(...conditions))
}

async function markExpiredOccurrencesAsFailed(
  db: Db,
  expired: ExpiredOccurrenceRow[],
  timezoneByUserId = new Map<string, string>(),
) {
  const now = new Date()
  let processed = 0

  for (const { occurrence, goal } of expired) {
    let failed = false

    await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(schema.occurrences)
        .where(and(
          eq(schema.occurrences.id, occurrence.id),
          eq(schema.occurrences.status, 'pending'),
        ))
        .for('update')

      if (!current) return

      await tx
        .update(schema.occurrences)
        .set({ status: 'failed', processedAt: now })
        .where(eq(schema.occurrences.id, occurrence.id))

      failed = true
      processed++
    })

    if (!failed) continue

    await triggerConsequencesOnFailure({
      userId: occurrence.userId,
      goalId: goal.id,
      occurrenceId: occurrence.id,
    })

    let timezone = timezoneByUserId.get(occurrence.userId)
    if (!timezone) {
      const [user] = await db
        .select({ timezone: schema.users.timezone })
        .from(schema.users)
        .where(eq(schema.users.id, occurrence.userId))
        .limit(1)
      timezone = user?.timezone
      if (timezone) {
        timezoneByUserId.set(occurrence.userId, timezone)
      }
    }

    if (timezone) {
      await reevaluateUserDay(occurrence.userId, occurrence.dueDate, timezone)
    }
  }

  return processed
}

export async function processExpiredOccurrencesForUser(userId: string) {
  const db = useDatabase()
  const [user] = await db
    .select({ timezone: schema.users.timezone })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)

  const timezoneByUserId = new Map<string, string>()
  if (user?.timezone) {
    timezoneByUserId.set(userId, user.timezone)
  }

  const expired = await fetchExpiredOccurrences(db, userId)
  const processed = await markExpiredOccurrencesAsFailed(db, expired, timezoneByUserId)

  return { processed, skipped: false }
}

export async function syncUserDeadlines(userId: string, timezone: string) {
  try {
    const expired = await processExpiredOccurrencesForUser(userId)
    const streaks = await processStreaksForUser(userId, timezone)
    return { expired, streaks }
  } catch (error) {
    console.error('[syncUserDeadlines] Failed:', error)
    return {
      expired: { processed: 0, skipped: true },
      streaks: 0,
    }
  }
}

export async function processExpiredOccurrences() {
  const lockKey = 'worker:deadlines'
  const acquired = await acquireLock(lockKey, 60000)
  if (!acquired) return { processed: 0, skipped: true }

  try {
    const db = useDatabase()
    const expired = await fetchExpiredOccurrences(db)
    const processed = await markExpiredOccurrencesAsFailed(db, expired)
    return { processed, skipped: false }
  } finally {
    await releaseLock(lockKey)
  }
}

export async function generateUpcomingOccurrences(dbInstance?: Db) {
  const db = dbInstance ?? useDatabase()
  const { generateOccurrenceDates, generateMilestoneOccurrences, getDateRange } = await import('./occurrences')

  const activeGoals = await db
    .select()
    .from(schema.goals)
    .where(eq(schema.goals.isActive, true))

  let created = 0

  for (const goal of activeGoals) {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, goal.userId))
      .limit(1)

    if (!user) continue

    const { from, to } = getDateRange(30, user.timezone)
    let dates: Array<{ dueDate: string; dueAt: Date; weekKey?: string; milestoneId?: string }> = []

    if (goal.type === 'project') {
      const milestones = await db
        .select()
        .from(schema.projectMilestones)
        .where(eq(schema.projectMilestones.goalId, goal.id))
      dates = generateMilestoneOccurrences(milestones, user.timezone, from, to)
    } else {
      dates = generateOccurrenceDates(goal, user.timezone, from, to)
    }

    for (const date of dates) {
      try {
        await db.insert(schema.occurrences).values({
          goalId: goal.id,
          userId: goal.userId,
          milestoneId: date.milestoneId,
          dueDate: date.dueDate,
          dueAt: date.dueAt,
          weekKey: date.weekKey,
          status: 'pending',
        }).onConflictDoNothing()
        created++
      } catch {
        // duplicate occurrence, skip
      }
    }
  }

  return { created }
}
