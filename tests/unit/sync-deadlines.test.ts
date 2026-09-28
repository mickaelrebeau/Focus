import { describe, it, expect, vi, beforeEach } from 'vitest'

type ExpiredRow = {
  occurrence: { id: string, userId: string, dueDate: string, status: string }
  goal: { id: string, isActive: boolean }
}

const state = vi.hoisted(() => ({
  // Échéances encore `pending` et expirées, telles que vues par la base
  pending: [] as ExpiredRow[],
  occurrenceUpdates: 0,
  redis: new Map<string, string>(),
  redisMode: 'up' as 'up' | 'down',
}))

vi.mock('../../server/utils/redis', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/utils/redis')>()
  return {
    ...actual,
    tryAcquireLock: vi.fn(async (key: string) => {
      if (state.redisMode === 'down') return 'unavailable'
      if (state.redis.has(`lock:${key}`)) return 'busy'
      state.redis.set(`lock:${key}`, '1')
      return 'acquired'
    }),
    releaseLock: vi.fn(async (key: string) => {
      state.redis.delete(`lock:${key}`)
    }),
    redisGet: vi.fn(async (key: string) => {
      if (state.redisMode === 'down') throw new Error('Redis down')
      return state.redis.get(key) ?? null
    }),
    redisSet: vi.fn(async (key: string, value: string) => {
      if (state.redisMode === 'down') throw new Error('Redis down')
      state.redis.set(key, value)
    }),
  }
})

vi.mock('../../server/utils/consequences-service', () => ({
  triggerConsequencesOnFailure: vi.fn(async () => ({ enqueued: 1, historyIds: ['history-1'] })),
}))

vi.mock('../../server/utils/streaks', () => ({
  processStreaksForUser: vi.fn(async () => 0),
  reevaluateUserDay: vi.fn(async () => null),
}))

vi.mock('../../server/database', () => ({
  useDatabase: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        // occurrences ⋈ goals ⋈ users (délai de grâce)
        innerJoin: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(async () => [...state.pending]),
          })),
        })),
      })),
    })),
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<void>) => {
      let lockedId: string | undefined
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn((condition: { id: string }) => ({
              for: vi.fn(async () => {
                lockedId = condition.id
                const row = state.pending.find(r => r.occurrence.id === condition.id)
                return row ? [row.occurrence] : []
              }),
            })),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(async () => {
              state.pending = state.pending.filter(r => r.occurrence.id !== lockedId)
              state.occurrenceUpdates += 1
            }),
          })),
        })),
      }
      await callback(tx)
    }),
  })),
  schema: {
    occurrences: {
      id: 'occurrences.id',
      userId: 'occurrences.user_id',
      goalId: 'occurrences.goal_id',
      dueAt: 'occurrences.due_at',
      status: 'occurrences.status',
    },
    goals: { id: 'goals.id', isActive: 'goals.is_active' },
    users: { id: 'users.id', graceMinutes: 'users.grace_minutes' },
  },
}))

// Les conditions drizzle sont réduites à l'id visé pour que la transaction simulée
// sache quelle échéance est verrouillée.
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    and: vi.fn((...conditions: Array<{ id?: string } | undefined>) => conditions.find(c => c?.id) ?? {}),
    eq: vi.fn((column: unknown, value: unknown) => (column === 'occurrences.id' ? { id: value } : {})),
    lte: vi.fn(() => ({})),
  }
})

import { syncUserDeadlines, SYNC_THROTTLE_SECONDS } from '../../server/utils/goals-service'
import { triggerConsequencesOnFailure } from '../../server/utils/consequences-service'
import { processStreaksForUser, reevaluateUserDay } from '../../server/utils/streaks'
import { redisSet, releaseLock, tryAcquireLock } from '../../server/utils/redis'

function expiredOccurrence(id = 'occ-1'): ExpiredRow {
  return {
    occurrence: { id, userId: 'user-1', dueDate: '2026-07-08', status: 'pending' },
    goal: { id: 'goal-1', isActive: true },
  }
}

describe('syncUserDeadlines', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.pending = []
    state.occurrenceUpdates = 0
    state.redis.clear()
    state.redisMode = 'up'
  })

  it('traite une échéance expirée : échec, conséquences, streak, puis pose le marqueur', async () => {
    state.pending = [expiredOccurrence()]

    const result = await syncUserDeadlines('user-1', 'Europe/Paris')

    expect(result).toEqual({ expired: { processed: 1, skipped: false }, streaks: 0 })
    expect(state.occurrenceUpdates).toBe(1)
    expect(triggerConsequencesOnFailure).toHaveBeenCalledWith({
      userId: 'user-1',
      goalId: 'goal-1',
      occurrenceId: 'occ-1',
    })
    expect(reevaluateUserDay).toHaveBeenCalledWith('user-1', '2026-07-08', 'Europe/Paris')
    expect(processStreaksForUser).toHaveBeenCalledWith('user-1', 'Europe/Paris')
    expect(redisSet).toHaveBeenCalledWith('sync-deadlines:last:user-1', '1', SYNC_THROTTLE_SECONDS)
    expect(releaseLock).toHaveBeenCalledWith('sync-deadlines:user-1', 500)
  })

  it('saute la synchronisation si rien n’a expiré et qu’elle a eu lieu récemment', async () => {
    state.redis.set('sync-deadlines:last:user-1', '1')

    const result = await syncUserDeadlines('user-1', 'Europe/Paris')

    expect(result).toEqual({ expired: { processed: 0, skipped: true }, streaks: 0 })
    expect(tryAcquireLock).not.toHaveBeenCalled()
    expect(processStreaksForUser).not.toHaveBeenCalled()
  })

  it('traite une échéance expirée même si une synchronisation a eu lieu récemment', async () => {
    state.redis.set('sync-deadlines:last:user-1', '1')
    state.pending = [expiredOccurrence()]

    const result = await syncUserDeadlines('user-1', 'Europe/Paris')

    expect(result.expired).toEqual({ processed: 1, skipped: false })
    expect(triggerConsequencesOnFailure).toHaveBeenCalledTimes(1)
  })

  it('clôture les jours passés quand rien n’a expiré mais que le marqueur a expiré', async () => {
    const result = await syncUserDeadlines('user-1', 'Europe/Paris')

    expect(result).toEqual({ expired: { processed: 0, skipped: false }, streaks: 0 })
    expect(processStreaksForUser).toHaveBeenCalledWith('user-1', 'Europe/Paris')
    expect(redisSet).toHaveBeenCalledWith('sync-deadlines:last:user-1', '1', SYNC_THROTTLE_SECONDS)
  })

  it('ne fait rien si une synchronisation du même utilisateur est déjà en cours', async () => {
    state.redis.set('lock:sync-deadlines:user-1', '1')
    state.pending = [expiredOccurrence()]

    const result = await syncUserDeadlines('user-1', 'Europe/Paris')

    expect(result).toEqual({ expired: { processed: 0, skipped: true }, streaks: 0 })
    expect(state.occurrenceUpdates).toBe(0)
    expect(triggerConsequencesOnFailure).not.toHaveBeenCalled()
    expect(releaseLock).not.toHaveBeenCalled()
  })

  it('un seul traitement pour deux lectures concurrentes du même utilisateur', async () => {
    state.pending = [expiredOccurrence()]

    const [first, second] = await Promise.all([
      syncUserDeadlines('user-1', 'Europe/Paris'),
      syncUserDeadlines('user-1', 'Europe/Paris'),
    ])

    expect(first.expired.processed + second.expired.processed).toBe(1)
    expect([first.expired.skipped, second.expired.skipped].sort()).toEqual([false, true])
    expect(triggerConsequencesOnFailure).toHaveBeenCalledTimes(1)
    expect(processStreaksForUser).toHaveBeenCalledTimes(1)
  })

  it('synchronise quand même si Redis est indisponible', async () => {
    state.redisMode = 'down'
    state.pending = [expiredOccurrence()]

    const result = await syncUserDeadlines('user-1', 'Europe/Paris')

    expect(result.expired).toEqual({ processed: 1, skipped: false })
    expect(triggerConsequencesOnFailure).toHaveBeenCalledTimes(1)
    expect(processStreaksForUser).toHaveBeenCalledTimes(1)
    expect(releaseLock).not.toHaveBeenCalled()
  })
})
