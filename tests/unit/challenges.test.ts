import { describe, it, expect, vi } from 'vitest'

vi.mock('../../server/database', () => ({ useDatabase: () => ({}), schema: {} }))

import { challengeStatus, closeInstant, rankParticipants, splitPot } from '../../server/utils/challenges'

describe('classement', () => {
  it('ex æquo au même rang, le suivant saute', () => {
    const ranked = rankParticipants([
      { id: 'a', score: 3 },
      { id: 'b', score: 5 },
      { id: 'c', score: 5 },
      { id: 'd', score: 1 },
    ])
    expect(ranked.map(p => [p.id, p.rank])).toEqual([['b', 1], ['c', 1], ['a', 3], ['d', 4]])
  })

  it('tous à zéro : tous premiers', () => {
    expect(rankParticipants([{ score: 0 }, { score: 0 }]).map(p => p.rank)).toEqual([1, 1])
  })
})

describe('cagnotte', () => {
  const joined = (minutes: number) => new Date(Date.UTC(2026, 8, 21, 8, minutes))

  it('un seul gagnant rafle tout', () => {
    expect(Object.fromEntries(splitPot(60, [{ userId: 'a', joinedAt: joined(0) }]))).toEqual({ a: 60 })
  })

  it('égalité : partage, le reste au premier inscrit, rien de perdu', () => {
    const payouts = splitPot(50, [
      { userId: 'late', joinedAt: joined(30) },
      { userId: 'early', joinedAt: joined(1) },
      { userId: 'mid', joinedAt: joined(10) },
    ])
    expect(Object.fromEntries(payouts)).toEqual({ early: 18, mid: 16, late: 16 })
    expect([...payouts.values()].reduce((a, b) => a + b, 0)).toBe(50)
  })

  it('cagnotte vide : aucun gain', () => {
    expect(splitPot(0, [{ userId: 'a', joinedAt: joined(0) }]).size).toBe(0)
  })
})

describe('calendrier', () => {
  const week = { weekStart: '2026-09-28', weekEnd: '2026-10-04', closedAt: null, outcome: null }

  it('statut selon la date locale', () => {
    expect(challengeStatus(week, '2026-09-27')).toBe('upcoming')
    expect(challengeStatus(week, '2026-09-28')).toBe('running')
    expect(challengeStatus(week, '2026-10-04')).toBe('running')
    expect(challengeStatus(week, '2026-10-05')).toBe('finishing')
    expect(challengeStatus({ ...week, closedAt: new Date() }, '2026-10-05')).toBe('closed')
    expect(challengeStatus({ ...week, closedAt: new Date(), outcome: 'cancelled' }, '2026-10-05')).toBe('cancelled')
  })

  it('clôture le lundi suivant à midi UTC', () => {
    expect(closeInstant('2026-10-04').toISOString()).toBe('2026-10-05T12:00:00.000Z')
  })
})
