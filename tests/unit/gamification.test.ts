import { describe, it, expect } from 'vitest'
import {
  buildStreakState,
  evaluateDayFromStatuses,
  calculateStreaksFromDates,
  STREAK_MILESTONE_DAYS,
} from '../../server/utils/streaks'
import { getWeekDates, getLeaderboardWeekKey, TOP3_WEEKLY_REWARDS } from '../../server/utils/leaderboard'

describe('streaks', () => {
  it('builds streak state with next milestone', () => {
    const state = buildStreakState(5, 10, '2026-07-10')
    expect(state.currentStreak).toBe(5)
    expect(state.longestStreak).toBe(10)
    expect(state.nextMilestone).toBe(7)
    expect(state.progressToNext).toBe(5)
  })

  it('marks empty day as neutral', () => {
    const result = evaluateDayFromStatuses('2026-07-10', [])
    expect(result.status).toBe('neutral')
    expect(result.totalOccurrences).toBe(0)
  })

  it('marks perfect day as success', () => {
    const result = evaluateDayFromStatuses('2026-07-10', [
      { status: 'completed' },
      { status: 'completed' },
    ])
    expect(result.status).toBe('success')
  })

  it('marks day with pending as neutral', () => {
    const result = evaluateDayFromStatuses('2026-07-10', [
      { status: 'completed' },
      { status: 'pending' },
    ])
    expect(result.status).toBe('neutral')
  })

  it('ignores skipped occurrences when evaluating a day', () => {
    const result = evaluateDayFromStatuses('2026-07-10', [
      { status: 'completed' },
      { status: 'skipped' },
    ])
    expect(result.status).toBe('success')
    expect(result.totalOccurrences).toBe(1)
  })

  it('marks day with failure as failed', () => {
    const result = evaluateDayFromStatuses('2026-07-10', [
      { status: 'completed' },
      { status: 'failed' },
    ])
    expect(result.status).toBe('failed')
  })

  it('calculates consecutive streaks from dates', () => {
    const result = calculateStreaksFromDates([
      '2026-07-08',
      '2026-07-09',
      '2026-07-10',
      '2026-07-12',
    ])
    expect(result.longest).toBe(3)
    expect(result.current).toBe(1)
    expect(result.lastDate).toBe('2026-07-12')
  })

  it('uses 7-day milestone interval', () => {
    const state = buildStreakState(7, 7, '2026-07-10')
    expect(state.nextMilestone).toBe(7)
    expect(state.progressToNext).toBe(0)
    expect(STREAK_MILESTONE_DAYS).toBe(7)
  })
})

describe('leaderboard', () => {
  it('returns 7 dates for a week key', () => {
    const dates = getWeekDates('2026-28')
    expect(dates).toHaveLength(7)
    expect(dates[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('generates leaderboard week key', () => {
    const key = getLeaderboardWeekKey(new Date('2026-07-10T12:00:00'))
    expect(key).toMatch(/^\d{4}-\d{2}$/)
  })

  it('defines top 3 weekly rewards', () => {
    expect(TOP3_WEEKLY_REWARDS[1]).toBe(10)
    expect(TOP3_WEEKLY_REWARDS[2]).toBe(5)
    expect(TOP3_WEEKLY_REWARDS[3]).toBe(2)
  })
})
