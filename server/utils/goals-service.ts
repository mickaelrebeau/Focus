import type { H3Event } from 'h3'
import { eq, and, lte } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { useDatabase, schema } from '../database'
import { triggerConsequencesOnFailure } from './consequences-service'
import { processStreaksForUser, reevaluateUserDay } from './streaks'
import { acquireLock, redisGet, redisSet, releaseLock, tryAcquireLock, withRedisTimeout } from './redis'
import { getEffectivePauses, isDateInPauses } from './pauses'

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

export const SYNC_LOCK_TTL_MS = 30_000
export const SYNC_THROTTLE_SECONDS = 60
const SYNC_REDIS_TIMEOUT_MS = 500

const syncLockKey = (userId: string) => `sync-deadlines:${userId}`
const syncThrottleKey = (userId: string) => `sync-deadlines:last:${userId}`

async function wasSyncedRecently(userId: string) {
  try {
    return (await withRedisTimeout(redisGet(syncThrottleKey(userId)), SYNC_REDIS_TIMEOUT_MS)) !== null
  } catch {
    return false
  }
}

async function markSynced(userId: string) {
  try {
    await withRedisTimeout(redisSet(syncThrottleKey(userId), '1', SYNC_THROTTLE_SECONDS), SYNC_REDIS_TIMEOUT_MS)
  } catch {
    // Sans marqueur, la prochaine lecture resynchronise : pas d'impact métier
  }
}

/**
 * Synchronisation à la lecture API, en complément du worker `deadlines`.
 * - Une échéance expirée est toujours traitée tout de suite (l'UI reste juste).
 * - Sinon, la clôture des jours passés n'est rejouée qu'une fois par SYNC_THROTTLE_SECONDS.
 * - Un verrou Redis par utilisateur empêche deux synchronisations concurrentes.
 * - Si Redis est indisponible, on synchronise quand même : les verrous `FOR UPDATE` et les
 *   index uniques de consequence_history évitent déjà tout double traitement.
 */
export async function syncUserDeadlines(userId: string, timezone: string) {
  const skipped = {
    expired: { processed: 0, skipped: true },
    streaks: 0,
  }

  try {
    const db = useDatabase()
    const expired = await fetchExpiredOccurrences(db, userId)

    if (expired.length === 0 && await wasSyncedRecently(userId)) {
      return skipped
    }

    const lock = await tryAcquireLock(syncLockKey(userId), SYNC_LOCK_TTL_MS, SYNC_REDIS_TIMEOUT_MS)
    if (lock === 'busy') {
      return skipped
    }

    try {
      const processed = await markExpiredOccurrencesAsFailed(db, expired, new Map([[userId, timezone]]))
      const streaks = await processStreaksForUser(userId, timezone)
      await markSynced(userId)
      return { expired: { processed, skipped: false }, streaks }
    } finally {
      if (lock === 'acquired') {
        await releaseLock(syncLockKey(userId), SYNC_REDIS_TIMEOUT_MS)
      }
    }
  } catch (error) {
    console.error('[syncUserDeadlines] Failed:', error)
    return skipped
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
  const pausesByUser = new Map<string, Awaited<ReturnType<typeof getEffectivePauses>>>()

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

    if (!pausesByUser.has(goal.userId)) {
      pausesByUser.set(goal.userId, await getEffectivePauses(goal.userId))
    }
    const pauses = pausesByUser.get(goal.userId)!

    for (const date of dates) {
      try {
        await db.insert(schema.occurrences).values({
          goalId: goal.id,
          userId: goal.userId,
          milestoneId: date.milestoneId,
          dueDate: date.dueDate,
          dueAt: date.dueAt,
          weekKey: date.weekKey,
          // Échéance tombant pendant une pause : créée directement « skipped »
          status: isDateInPauses(date.dueDate, pauses) ? 'skipped' : 'pending',
        }).onConflictDoNothing({
          target: [
            schema.occurrences.goalId,
            schema.occurrences.dueDate,
            schema.occurrences.milestoneId,
          ],
        })
        created++
      } catch {
        // duplicate occurrence, skip
      }
    }
  }

  return { created }
}

export async function requireOwnedGoal(event: H3Event, userId: string) {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID requis' })

  const db = useDatabase()
  const [goal] = await db
    .select()
    .from(schema.goals)
    .where(and(eq(schema.goals.id, id), eq(schema.goals.userId, userId)))
    .limit(1)

  if (!goal) throw createError({ statusCode: 404, message: 'Objectif introuvable' })

  return goal
}
