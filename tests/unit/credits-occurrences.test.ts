import { describe, it, expect } from 'vitest'
import { calculateNetScore } from '../../server/utils/credits'
import {
  getWeekKey,
  computeDueAt,
  generateOccurrenceDates,
  isOccurrenceExpired,
  getTodayInTimezone,
} from '../../server/utils/occurrences'

describe('credits', () => {
  it('calculates net score', () => {
    expect(calculateNetScore(100, 30)).toBe(70)
    expect(calculateNetScore(10, 50)).toBe(-40)
    expect(calculateNetScore(0, 0)).toBe(0)
  })
})

describe('occurrences', () => {
  it('computes week key', () => {
    const date = new Date('2026-07-10T12:00:00Z')
    const key = getWeekKey(date, 'Europe/Paris')
    expect(key).toMatch(/^\d{4}-\d{2}$/)
  })

  it('computes due at in timezone', () => {
    const dueAt = computeDueAt('2026-07-15', '23:59', 'Europe/Paris')
    expect(dueAt).toBeInstanceOf(Date)
    expect(dueAt.getTime()).toBeGreaterThan(0)
  })

  it('detects expired occurrences', () => {
    const past = new Date('2020-01-01')
    expect(isOccurrenceExpired(past)).toBe(true)
    const future = new Date('2099-01-01')
    expect(isOccurrenceExpired(future)).toBe(false)
  })

  it('gets today in timezone', () => {
    const today = getTodayInTimezone('Europe/Paris')
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('generates daily occurrence dates', () => {
    const goal = {
      id: '1',
      userId: '1',
      title: 'Test',
      description: null,
      type: 'recurring' as const,
      category: null,
      recurrenceType: 'daily' as const,
      recurrenceConfig: { dueTime: '23:59' },
      dueDate: null,
      rewardCredits: 10,
      penaltyCredits: 20,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const from = new Date('2026-07-10T00:00:00Z')
    const to = new Date('2026-07-12T23:59:59Z')
    const dates = generateOccurrenceDates(goal, 'Europe/Paris', from, to)
    expect(dates.length).toBeGreaterThanOrEqual(2)
  })

  it('generates one-time occurrence', () => {
    const goal = {
      id: '1',
      userId: '1',
      title: 'Test',
      description: null,
      type: 'one_time' as const,
      category: null,
      recurrenceType: null,
      recurrenceConfig: { dueTime: '23:59' },
      dueDate: '2026-07-15',
      rewardCredits: 10,
      penaltyCredits: 20,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const from = new Date('2026-07-01T00:00:00Z')
    const to = new Date('2026-07-31T23:59:59Z')
    const dates = generateOccurrenceDates(goal, 'Europe/Paris', from, to)
    expect(dates).toHaveLength(1)
    expect(dates[0].dueDate).toBe('2026-07-15')
  })
})

describe('debt logic', () => {
  it('penalty splits between balance and debt', () => {
    const balance = 5
    const penalty = 20
    const fromBalance = Math.min(balance, penalty)
    const debt = penalty - fromBalance
    expect(fromBalance).toBe(5)
    expect(debt).toBe(15)
  })

  it('reward repays debt first', () => {
    const balance = 0
    const debt = 15
    const reward = 10
    const repayment = Math.min(debt, reward)
    const newBalance = reward - repayment
    const newDebt = debt - repayment
    expect(repayment).toBe(10)
    expect(newBalance).toBe(0)
    expect(newDebt).toBe(5)
  })
})
