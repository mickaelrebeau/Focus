import { describe, it, expect, vi, beforeEach } from 'vitest'

const dbState = vi.hoisted(() => ({
  expiredOccurrences: [] as Array<{
    occurrence: { id: string, userId: string, dueDate: string, status: string }
    goal: { id: string, isActive: boolean }
  }>,
  users: [] as Array<{ id: string, timezone: string, isBlocked: boolean }>,
  pastDueDates: [] as Array<{ dueDate: string }>,
  dailyResults: [] as Array<{ userId: string, dateKey: string, status: string }>,
  occurrenceStatuses: [] as Array<{ status: string }>,
  streaks: [] as Array<{ userId: string, currentStreak: number, longestStreak: number, lastSuccessDate: string | null }>,
  occurrenceUpdates: 0,
}))

function resolveTerminalQuery(mode: 'users' | 'dates' | 'occurrences' | 'daily' | 'streak' | 'timezone') {
  switch (mode) {
    case 'users':
      return dbState.users
    case 'dates':
      return dbState.pastDueDates
    case 'occurrences':
      return dbState.occurrenceStatuses
    case 'daily':
      return dbState.dailyResults.slice(0, 1)
    case 'streak':
      return dbState.streaks.slice(0, 1)
    case 'timezone':
      return dbState.users.slice(0, 1).map(user => ({ timezone: user.timezone }))
    default:
      return []
  }
}

function createQueryChain(mode: 'users' | 'dates' | 'occurrences' | 'daily' | 'streak' | 'timezone') {
  const result = Promise.resolve(resolveTerminalQuery(mode))
  return Object.assign(result, {
    orderBy: vi.fn(async () => resolveTerminalQuery(mode === 'users' ? 'dates' : mode)),
    limit: vi.fn(async () => resolveTerminalQuery(mode === 'daily' ? 'daily' : mode === 'streak' ? 'streak' : 'timezone')),
    for: vi.fn(() => createQueryChain('occurrences')),
  })
}

vi.mock('../../server/utils/redis', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/utils/redis')>()
  return {
    ...actual,
    acquireLock: vi.fn(async () => true),
    releaseLock: vi.fn(async () => {}),
  }
})

vi.mock('../../server/utils/consequences-service', () => ({
  triggerConsequencesOnFailure: vi.fn(async () => ({ triggered: true })),
}))

vi.mock('../../server/utils/streaks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/utils/streaks')>()
  return {
    ...actual,
    reevaluateUserDay: vi.fn(async () => null),
  }
})

vi.mock('../../server/utils/occurrences', () => ({
  getTodayInTimezone: vi.fn(() => '2026-07-11'),
}))

vi.mock('../../server/database', () => ({
  useDatabase: vi.fn(() => ({
    select: vi.fn((fields?: Record<string, unknown>) => {
      if (!fields || Object.keys(fields).length === 0) {
        return { from: vi.fn(() => ({ where: vi.fn(() => createQueryChain('daily')) })) }
      }
      if (fields && 'dueDate' in fields) {
        return { from: vi.fn(() => ({ where: vi.fn(() => createQueryChain('dates')) })) }
      }
      if (fields && 'status' in fields && Object.keys(fields).length === 1) {
        return { from: vi.fn(() => ({ where: vi.fn(() => createQueryChain('occurrences')) })) }
      }
      if (fields && 'dateKey' in fields && 'status' in fields) {
        return { from: vi.fn(() => ({ where: vi.fn(() => createQueryChain('daily')) })) }
      }
      if (fields && 'timezone' in fields && Object.keys(fields).length === 1) {
        return { from: vi.fn(() => ({ where: vi.fn(() => createQueryChain('timezone')) })) }
      }
      if (fields && 'currentStreak' in fields) {
        return { from: vi.fn(() => ({ where: vi.fn(() => createQueryChain('streak')) })) }
      }
      return {
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(async () => dbState.expiredOccurrences),
          })),
          where: vi.fn(() => createQueryChain('users')),
        })),
      }
    }),
    selectDistinct: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => createQueryChain('dates')),
      })),
    })),
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<void>) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              for: vi.fn(async () => [dbState.expiredOccurrences[0]?.occurrence].filter(Boolean)),
            })),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(async () => {
              dbState.occurrenceUpdates += 1
            }),
          })),
        })),
      }
      await callback(tx)
    }),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(async () => {}),
        returning: vi.fn(async () => [{ userId: 'user-1', currentStreak: 0, longestStreak: 0 }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => {}),
      })),
    })),
  })),
  schema: {
    occurrences: {
      id: 'occurrences.id',
      userId: 'occurrences.user_id',
      goalId: 'occurrences.goal_id',
      dueDate: 'occurrences.due_date',
      dueAt: 'occurrences.due_at',
      status: 'occurrences.status',
    },
    goals: { id: 'goals.id', isActive: 'goals.is_active' },
    users: { id: 'users.id', timezone: 'users.timezone', isBlocked: 'users.is_blocked' },
    userDailyResults: {
      userId: 'user_daily_results.user_id',
      dateKey: 'user_daily_results.date_key',
      status: 'user_daily_results.status',
      totalOccurrences: 'user_daily_results.total_occurrences',
      completedOccurrences: 'user_daily_results.completed_occurrences',
      failedOccurrences: 'user_daily_results.failed_occurrences',
    },
    userStreaks: {
      userId: 'user_streaks.user_id',
      currentStreak: 'user_streaks.current_streak',
      longestStreak: 'user_streaks.longest_streak',
      lastSuccessDate: 'user_streaks.last_success_date',
    },
  },
}))

import { processExpiredOccurrences } from '../../server/utils/goals-service'
import { processStreaksAfterExpiration } from '../../server/utils/streaks'
import { triggerConsequencesOnFailure } from '../../server/utils/consequences-service'
import { reevaluateUserDay } from '../../server/utils/streaks'
import { acquireLock, releaseLock } from '../../server/utils/redis'

describe('processExpiredOccurrences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbState.occurrenceUpdates = 0
    dbState.expiredOccurrences = [{
      occurrence: {
        id: 'occ-1',
        userId: 'user-1',
        dueDate: '2026-07-08',
        status: 'pending',
      },
      goal: { id: 'goal-1', isActive: true },
    }]
    dbState.users = [{ id: 'user-1', timezone: 'Europe/Paris', isBlocked: false }]
  })

  it('marks expired occurrences as failed and triggers consequences', async () => {
    const result = await processExpiredOccurrences()

    expect(acquireLock).toHaveBeenCalledWith('worker:deadlines', 60000)
    expect(result).toEqual({ processed: 1, skipped: false })
    expect(dbState.occurrenceUpdates).toBe(1)
    expect(triggerConsequencesOnFailure).toHaveBeenCalledWith({
      userId: 'user-1',
      goalId: 'goal-1',
      occurrenceId: 'occ-1',
    })
    expect(reevaluateUserDay).toHaveBeenCalledWith('user-1', '2026-07-08', 'Europe/Paris')
    expect(releaseLock).toHaveBeenCalledWith('worker:deadlines')
  })
})

describe('processStreaksAfterExpiration backlog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbState.users = [{ id: 'user-1', timezone: 'Europe/Paris', isBlocked: false }]
    dbState.pastDueDates = [
      { dueDate: '2026-07-08' },
      { dueDate: '2026-07-09' },
    ]
    dbState.dailyResults = []
    dbState.streaks = [{ userId: 'user-1', currentStreak: 3, longestStreak: 3, lastSuccessDate: '2026-07-07' }]
    dbState.occurrenceStatuses = [{ status: 'failed' }]
  })

  it('processes multiple unclosed days instead of only yesterday', async () => {
    dbState.occurrenceStatuses = [{ status: 'pending' }]

    const processed = await processStreaksAfterExpiration()

    expect(processed).toBe(2)
  })

  it('skips days already closed as failed', async () => {
    dbState.pastDueDates = [{ dueDate: '2026-07-08' }]
    dbState.dailyResults = [{ userId: 'user-1', dateKey: '2026-07-08', status: 'failed' }]

    const processed = await processStreaksAfterExpiration()

    expect(processed).toBe(0)
  })
})
