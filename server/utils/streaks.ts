import { eq, and } from 'drizzle-orm'
import { addDays, format, parseISO } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { useDatabase, schema } from '../database'
import { awardStreakBonus } from './credits'
import { getTodayInTimezone } from './occurrences'

export const STREAK_MILESTONE_DAYS = 7
export const STREAK_MILESTONE_REWARD = 10

export type DailyResultStatus = 'neutral' | 'success' | 'failed'

export interface DayEvaluation {
  dateKey: string
  status: DailyResultStatus
  totalOccurrences: number
  completedOccurrences: number
  failedOccurrences: number
}

export interface StreakState {
  currentStreak: number
  longestStreak: number
  lastSuccessDate: string | null
  nextMilestone: number
  progressToNext: number
}

export interface StreakUpdateResult {
  dailyPerfect: boolean
  dayStatus: DailyResultStatus
  dateKey: string
  streak: StreakState
  bonusAwarded: number | null
  milestoneReached: number | null
}

function getNextMilestone(currentStreak: number): number {
  if (currentStreak <= 0) return STREAK_MILESTONE_DAYS
  return Math.ceil(currentStreak / STREAK_MILESTONE_DAYS) * STREAK_MILESTONE_DAYS
}

function getProgressToNext(currentStreak: number): number {
  if (currentStreak <= 0) return 0
  return currentStreak % STREAK_MILESTONE_DAYS
}

export function buildStreakState(
  currentStreak: number,
  longestStreak: number,
  lastSuccessDate: string | null,
): StreakState {
  return {
    currentStreak,
    longestStreak,
    lastSuccessDate,
    nextMilestone: getNextMilestone(currentStreak),
    progressToNext: getProgressToNext(currentStreak),
  }
}

export function evaluateDayFromStatuses(
  dateKey: string,
  statuses: Array<{ status: string }>,
): DayEvaluation {
  const relevant = statuses.filter(r => r.status !== 'skipped')
  const totalOccurrences = relevant.length
  const completedOccurrences = relevant.filter(r => r.status === 'completed').length
  const failedOccurrences = relevant.filter(r => r.status === 'failed').length
  const pendingOccurrences = relevant.filter(r => r.status === 'pending').length

  let status: DailyResultStatus = 'neutral'

  if (totalOccurrences === 0) {
    status = 'neutral'
  } else if (failedOccurrences > 0) {
    status = 'failed'
  } else if (pendingOccurrences > 0) {
    status = 'neutral'
  } else if (completedOccurrences === totalOccurrences) {
    status = 'success'
  }

  return {
    dateKey,
    status,
    totalOccurrences,
    completedOccurrences,
    failedOccurrences,
  }
}

export async function evaluateDayForUser(
  userId: string,
  dateKey: string,
): Promise<DayEvaluation> {
  const db = useDatabase()

  const rows = await db
    .select({ status: schema.occurrences.status })
    .from(schema.occurrences)
    .where(and(
      eq(schema.occurrences.userId, userId),
      eq(schema.occurrences.dueDate, dateKey),
    ))

  return evaluateDayFromStatuses(dateKey, rows)
}

async function getOrCreateUserStreak(userId: string) {
  const db = useDatabase()
  const [existing] = await db
    .select()
    .from(schema.userStreaks)
    .where(eq(schema.userStreaks.userId, userId))
    .limit(1)

  if (existing) return existing

  const [created] = await db.insert(schema.userStreaks).values({
    userId,
    currentStreak: 0,
    longestStreak: 0,
  }).returning()

  return created
}

function isConsecutiveDay(previousDate: string, nextDate: string): boolean {
  const prev = parseISO(previousDate)
  const next = parseISO(nextDate)
  const diffMs = next.getTime() - prev.getTime()
  const oneDayMs = 24 * 60 * 60 * 1000
  return diffMs === oneDayMs
}

export function calculateStreaksFromDates(dates: string[]): {
  current: number
  longest: number
  lastDate: string | null
} {
  if (!dates.length) return { current: 0, longest: 0, lastDate: null }

  let longestStreak = 1
  let run = 1

  for (let i = 1; i < dates.length; i++) {
    if (isConsecutiveDay(dates[i - 1]!, dates[i]!)) {
      run++
    } else {
      run = 1
    }
    longestStreak = Math.max(longestStreak, run)
  }

  let currentStreak = 1
  for (let i = dates.length - 1; i > 0; i--) {
    if (isConsecutiveDay(dates[i - 1]!, dates[i]!)) {
      currentStreak++
    } else {
      break
    }
  }

  return {
    current: currentStreak,
    longest: longestStreak,
    lastDate: dates[dates.length - 1]!,
  }
}

async function recalculateStreakFromHistory(userId: string) {
  const db = useDatabase()

  const successDays = await db
    .select({ dateKey: schema.userDailyResults.dateKey })
    .from(schema.userDailyResults)
    .where(and(
      eq(schema.userDailyResults.userId, userId),
      eq(schema.userDailyResults.status, 'success'),
    ))
    .orderBy(schema.userDailyResults.dateKey)

  if (!successDays.length) {
    await db.update(schema.userStreaks)
      .set({ currentStreak: 0, lastSuccessDate: null, updatedAt: new Date() })
      .where(eq(schema.userStreaks.userId, userId))
    return buildStreakState(0, 0, null)
  }

  const dates = successDays.map(d => d.dateKey)
  const { current: currentStreak, longest: longestStreak, lastDate } = calculateStreaksFromDates(dates)

  const [streakRow] = await db
    .select()
    .from(schema.userStreaks)
    .where(eq(schema.userStreaks.userId, userId))
    .limit(1)

  const longest = Math.max(streakRow?.longestStreak ?? 0, longestStreak)

  await db.update(schema.userStreaks)
    .set({
      currentStreak,
      longestStreak: longest,
      lastSuccessDate: lastDate,
      updatedAt: new Date(),
    })
    .where(eq(schema.userStreaks.userId, userId))

  return buildStreakState(currentStreak, longest, lastDate)
}

async function awardMilestoneIfNeeded(userId: string, currentStreak: number): Promise<{
  bonusAwarded: number | null
  milestoneReached: number | null
}> {
  if (currentStreak <= 0 || currentStreak % STREAK_MILESTONE_DAYS !== 0) {
    return { bonusAwarded: null, milestoneReached: null }
  }

  const db = useDatabase()
  const milestone = currentStreak

  const [existing] = await db
    .select()
    .from(schema.streakRewards)
    .where(and(
      eq(schema.streakRewards.userId, userId),
      eq(schema.streakRewards.milestone, milestone),
    ))
    .limit(1)

  if (existing) {
    return { bonusAwarded: null, milestoneReached: null }
  }

  const { entry } = await awardStreakBonus(userId, STREAK_MILESTONE_REWARD, milestone)

  await db.insert(schema.streakRewards).values({
    userId,
    milestone,
    amount: STREAK_MILESTONE_REWARD,
    creditLedgerId: entry.id,
  })

  return { bonusAwarded: STREAK_MILESTONE_REWARD, milestoneReached: milestone }
}

export async function updateStreakForDate(
  userId: string,
  dateKey: string,
  timezone: string,
): Promise<StreakUpdateResult> {
  const db = useDatabase()
  await getOrCreateUserStreak(userId)

  const evaluation = await evaluateDayForUser(userId, dateKey)

  await db
    .insert(schema.userDailyResults)
    .values({
      userId,
      dateKey,
      status: evaluation.status,
      totalOccurrences: evaluation.totalOccurrences,
      completedOccurrences: evaluation.completedOccurrences,
      failedOccurrences: evaluation.failedOccurrences,
    })
    .onConflictDoUpdate({
      target: [schema.userDailyResults.userId, schema.userDailyResults.dateKey],
      set: {
        status: evaluation.status,
        totalOccurrences: evaluation.totalOccurrences,
        completedOccurrences: evaluation.completedOccurrences,
        failedOccurrences: evaluation.failedOccurrences,
        evaluatedAt: new Date(),
      },
    })

  const streak = await recalculateStreakFromHistory(userId)

  let bonusAwarded: number | null = null
  let milestoneReached: number | null = null

  if (evaluation.status === 'success') {
    const award = await awardMilestoneIfNeeded(userId, streak.currentStreak)
    bonusAwarded = award.bonusAwarded
    milestoneReached = award.milestoneReached
  }

  return {
    dailyPerfect: evaluation.status === 'success',
    dayStatus: evaluation.status,
    dateKey,
    streak,
    bonusAwarded,
    milestoneReached,
  }
}

export async function getStreakForUser(userId: string): Promise<StreakState> {
  const db = useDatabase()
  const [row] = await db
    .select()
    .from(schema.userStreaks)
    .where(eq(schema.userStreaks.userId, userId))
    .limit(1)

  if (!row) {
    return buildStreakState(0, 0, null)
  }

  return buildStreakState(row.currentStreak, row.longestStreak, row.lastSuccessDate)
}

export async function processStreaksAfterExpiration() {
  const db = useDatabase()

  const users = await db
    .select({ id: schema.users.id, timezone: schema.users.timezone })
    .from(schema.users)
    .where(eq(schema.users.isBlocked, false))

  let processed = 0

  for (const user of users) {
    const userToday = getTodayInTimezone(user.timezone)
    const userYesterday = format(addDays(parseISO(userToday), -1), 'yyyy-MM-dd')

    const evaluation = await evaluateDayForUser(user.id, userYesterday)
    if (evaluation.totalOccurrences === 0) continue

    const [existing] = await db
      .select()
      .from(schema.userDailyResults)
      .where(and(
        eq(schema.userDailyResults.userId, user.id),
        eq(schema.userDailyResults.dateKey, userYesterday),
      ))
      .limit(1)

    if (existing?.status === 'success' || existing?.status === 'failed') continue

    if (evaluation.status === 'neutral') {
      await closePendingDayAsFailed(user.id, userYesterday, user.timezone)
    } else {
      await updateStreakForDate(user.id, userYesterday, user.timezone)
    }

    processed++
  }

  return processed
}

export async function reevaluateUserDay(userId: string, dateKey: string, timezone: string) {
  return updateStreakForDate(userId, dateKey, timezone)
}

export async function syncTodayStreak(
  userId: string,
  timezone: string,
): Promise<StreakUpdateResult> {
  const today = getTodayInTimezone(timezone)
  return updateStreakForDate(userId, today, timezone)
}

export async function handleDayCompletion(
  userId: string,
  timezone: string,
): Promise<StreakUpdateResult | null> {
  const result = await syncTodayStreak(userId, timezone)
  return result.dailyPerfect ? result : null
}

export async function closePendingDayAsFailed(userId: string, dateKey: string, timezone: string) {
  const evaluation = await evaluateDayForUser(userId, dateKey)
  if (evaluation.totalOccurrences === 0) return null

  const db = useDatabase()
  const failedEvaluation: DayEvaluation = {
    ...evaluation,
    status: 'failed',
    failedOccurrences: evaluation.totalOccurrences - evaluation.completedOccurrences,
  }

  await db
    .insert(schema.userDailyResults)
    .values({
      userId,
      dateKey,
      status: failedEvaluation.status,
      totalOccurrences: failedEvaluation.totalOccurrences,
      completedOccurrences: failedEvaluation.completedOccurrences,
      failedOccurrences: failedEvaluation.failedOccurrences,
    })
    .onConflictDoUpdate({
      target: [schema.userDailyResults.userId, schema.userDailyResults.dateKey],
      set: {
        status: 'failed',
        failedOccurrences: failedEvaluation.failedOccurrences,
        evaluatedAt: new Date(),
      },
    })

  return updateStreakForDate(userId, dateKey, timezone)
}
