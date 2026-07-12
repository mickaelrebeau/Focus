import { eq, and, sql, desc } from 'drizzle-orm'
import { addDays, format, parseISO, startOfISOWeek, setISOWeek, subWeeks } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { useDatabase, schema } from '../database'
import { calculateNetScore, awardLeaderboardReward } from './credits'
import { getWeekKey } from './occurrences'
import { getStreakForUser } from './streaks'

export const LEADERBOARD_TIMEZONE = 'Europe/Paris'
export const TOP3_WEEKLY_REWARDS: Record<number, number> = { 1: 10, 2: 5, 3: 2 }
export const QUALIFYING_DAYS = 7

export interface LeaderboardEntry {
  userId: string
  displayName: string
  balance: number
  debt: number
  netScore: number
  rank: number
  currentStreak: number
  longestStreak: number
  isCurrentUser?: boolean
}

export interface WeeklyProgress {
  weekKey: string
  daysQualified: number
  daysRequired: number
  isEligible: boolean
  projectedRank: number | null
}

function getDateInLeaderboardTz(date = new Date()): Date {
  return toZonedTime(date, LEADERBOARD_TIMEZONE)
}

export function getLeaderboardToday(): string {
  return format(getDateInLeaderboardTz(), 'yyyy-MM-dd')
}

export function getLeaderboardWeekKey(date = new Date()): string {
  return getWeekKey(date, LEADERBOARD_TIMEZONE)
}

export function getPreviousWeekKey(): string {
  const zoned = getDateInLeaderboardTz()
  const prevWeek = subWeeks(zoned, 1)
  return getWeekKey(prevWeek, LEADERBOARD_TIMEZONE)
}

export function getWeekDates(weekKey: string): string[] {
  const [yearStr, weekStr] = weekKey.split('-')
  const year = Number(yearStr)
  const week = Number(weekStr)
  const ref = setISOWeek(new Date(year, 0, 4), week)
  const weekStart = startOfISOWeek(ref)

  return Array.from({ length: 7 }, (_, i) =>
    format(addDays(weekStart, i), 'yyyy-MM-dd'),
  )
}

async function fetchRankedEntries(): Promise<LeaderboardEntry[]> {
  const db = useDatabase()

  const wallets = await db
    .select({
      userId: schema.users.id,
      displayName: schema.users.displayName,
      balance: schema.wallets.balance,
      debt: schema.wallets.debt,
      leaderboardOptIn: schema.users.leaderboardOptIn,
      createdAt: schema.users.createdAt,
    })
    .from(schema.wallets)
    .innerJoin(schema.users, eq(schema.wallets.userId, schema.users.id))
    .where(eq(schema.users.isBlocked, false))

  const entries = wallets
    .filter(w => w.leaderboardOptIn)
    .map(w => ({
      userId: w.userId,
      displayName: w.displayName,
      balance: w.balance,
      debt: w.debt,
      netScore: calculateNetScore(w.balance, w.debt),
      createdAt: w.createdAt,
    }))
    .sort((a, b) => {
      if (b.netScore !== a.netScore) return b.netScore - a.netScore
      if (a.createdAt.getTime() !== b.createdAt.getTime()) {
        return a.createdAt.getTime() - b.createdAt.getTime()
      }
      return a.userId.localeCompare(b.userId)
    })

  const withStreaks = await Promise.all(entries.map(async (entry, index) => {
    const streak = await getStreakForUser(entry.userId)
    return {
      userId: entry.userId,
      displayName: entry.displayName,
      balance: entry.balance,
      debt: entry.debt,
      netScore: entry.netScore,
      rank: index + 1,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
    }
  }))

  return withStreaks
}

export async function getLeaderboard(currentUserId?: string) {
  const leaderboard = await fetchRankedEntries()

  if (currentUserId) {
    return leaderboard.map(entry => ({
      ...entry,
      isCurrentUser: entry.userId === currentUserId,
    }))
  }

  return leaderboard
}

export async function createDailySnapshot(snapshotDate?: string) {
  const db = useDatabase()
  const date = snapshotDate ?? getLeaderboardToday()
  const weekKey = getLeaderboardWeekKey(parseISO(`${date}T12:00:00`))
  const entries = await fetchRankedEntries()

  let inserted = 0

  for (const entry of entries) {
    const result = await db
      .insert(schema.leaderboardDailySnapshots)
      .values({
        weekKey,
        snapshotDate: date,
        userId: entry.userId,
        rank: entry.rank,
        netScore: entry.netScore,
        balance: entry.balance,
        debt: entry.debt,
      })
      .onConflictDoUpdate({
        target: [schema.leaderboardDailySnapshots.snapshotDate, schema.leaderboardDailySnapshots.userId],
        set: {
          rank: entry.rank,
          netScore: entry.netScore,
          balance: entry.balance,
          debt: entry.debt,
          weekKey,
        },
      })
      .returning()

    if (result.length) inserted++
  }

  return { snapshotDate: date, weekKey, inserted, total: entries.length }
}

export async function getWeeklyProgressForUser(userId: string, weekKey?: string): Promise<WeeklyProgress> {
  const db = useDatabase()
  const key = weekKey ?? getLeaderboardWeekKey()

  const snapshots = await db
    .select({ rank: schema.leaderboardDailySnapshots.rank })
    .from(schema.leaderboardDailySnapshots)
    .where(and(
      eq(schema.leaderboardDailySnapshots.userId, userId),
      eq(schema.leaderboardDailySnapshots.weekKey, key),
      sql`${schema.leaderboardDailySnapshots.rank} <= 3`,
    ))

  const daysQualified = snapshots.length
  const weekDates = getWeekDates(key)
  const today = getLeaderboardToday()
  const pastDates = weekDates.filter(d => d <= today)

  let projectedRank: number | null = null
  if (daysQualified > 0) {
    const [lastSnapshot] = await db
      .select({ rank: schema.leaderboardDailySnapshots.rank })
      .from(schema.leaderboardDailySnapshots)
      .where(and(
        eq(schema.leaderboardDailySnapshots.userId, userId),
        eq(schema.leaderboardDailySnapshots.weekKey, key),
      ))
      .orderBy(desc(schema.leaderboardDailySnapshots.snapshotDate))
      .limit(1)

    projectedRank = lastSnapshot?.rank ?? null
  }

  return {
    weekKey: key,
    daysQualified,
    daysRequired: QUALIFYING_DAYS,
    isEligible: daysQualified >= QUALIFYING_DAYS && pastDates.length >= QUALIFYING_DAYS,
    projectedRank: projectedRank && projectedRank <= 3 ? projectedRank : null,
  }
}

export async function settlePreviousWeekRewards() {
  const db = useDatabase()
  const weekKey = getPreviousWeekKey()
  const weekDates = getWeekDates(weekKey)

  const qualifiedUsers = await db
    .select({
      userId: schema.leaderboardDailySnapshots.userId,
      daysCount: sql<number>`count(*)::int`,
    })
    .from(schema.leaderboardDailySnapshots)
    .where(and(
      eq(schema.leaderboardDailySnapshots.weekKey, weekKey),
      sql`${schema.leaderboardDailySnapshots.rank} <= 3`,
    ))
    .groupBy(schema.leaderboardDailySnapshots.userId)
    .having(sql`count(*) = ${QUALIFYING_DAYS}`)

  if (!qualifiedUsers.length) {
    return { weekKey, rewarded: 0 }
  }

  const lastDate = weekDates[weekDates.length - 1]!
  const finalists: Array<{ userId: string, finalRank: number, daysQualified: number }> = []

  for (const user of qualifiedUsers) {
    const [sundaySnapshot] = await db
      .select({ rank: schema.leaderboardDailySnapshots.rank })
      .from(schema.leaderboardDailySnapshots)
      .where(and(
        eq(schema.leaderboardDailySnapshots.userId, user.userId),
        eq(schema.leaderboardDailySnapshots.weekKey, weekKey),
        eq(schema.leaderboardDailySnapshots.snapshotDate, lastDate),
      ))
      .limit(1)

    if (sundaySnapshot && sundaySnapshot.rank <= 3) {
      finalists.push({
        userId: user.userId,
        finalRank: sundaySnapshot.rank,
        daysQualified: user.daysCount,
      })
    }
  }

  finalists.sort((a, b) => a.finalRank - b.finalRank)
  const top3 = finalists.slice(0, 3)

  let rewarded = 0

  for (const finalist of top3) {
    const rewardAmount = TOP3_WEEKLY_REWARDS[finalist.finalRank]
    if (!rewardAmount) continue

    const [existing] = await db
      .select()
      .from(schema.leaderboardWeeklyRewards)
      .where(and(
        eq(schema.leaderboardWeeklyRewards.weekKey, weekKey),
        eq(schema.leaderboardWeeklyRewards.userId, finalist.userId),
      ))
      .limit(1)

    if (existing) continue

    const { entry } = await awardLeaderboardReward(
      finalist.userId,
      rewardAmount,
      weekKey,
      finalist.finalRank,
    )

    await db.insert(schema.leaderboardWeeklyRewards).values({
      weekKey,
      userId: finalist.userId,
      finalRank: finalist.finalRank,
      rewardAmount,
      daysQualified: finalist.daysQualified,
      creditLedgerId: entry.id,
    })

    rewarded++
  }

  return { weekKey, rewarded, finalists: top3 }
}

export async function runLeaderboardJobs() {
  const today = getLeaderboardToday()
  const zoned = getDateInLeaderboardTz()
  const dayOfWeek = zoned.getDay() // 0=Sun, 1=Mon

  const snapshot = await createDailySnapshot(today)

  let settlement = null
  if (dayOfWeek === 1) {
    settlement = await settlePreviousWeekRewards()
  }

  return { snapshot, settlement }
}
