import { describe, it, expect } from 'vitest'
import { buildWeeklyCsv, computeWeeklyReview, weekRange } from '../../server/utils/weekly-review'

const week = weekRange('2026-09-24') // jeudi → semaine du lundi 21 au dimanche 27

describe('weekRange', () => {
  it('va du lundi au dimanche', () => {
    expect(week.start).toBe('2026-09-21')
    expect(week.end).toBe('2026-09-27')
    expect(week.dates).toHaveLength(7)
    expect(weekRange('2026-09-21').start).toBe('2026-09-21')
    expect(weekRange('2026-09-27').start).toBe('2026-09-21')
  })
})

describe('computeWeeklyReview', () => {
  const review = computeWeeklyReview({
    week,
    occurrences: [
      { dueDate: '2026-09-21', status: 'completed' },
      { dueDate: '2026-09-22', status: 'completed' },
      { dueDate: '2026-09-23', status: 'failed' },
      { dueDate: '2026-09-24', status: 'completed' },
      { dueDate: '2026-09-25', status: 'skipped' },
      { dueDate: '2026-09-27', status: 'pending' },
      // hors semaine : ignoré
      { dueDate: '2026-09-28', status: 'failed' },
    ],
    dailyResults: [
      { dateKey: '2026-09-21', status: 'success' },
      { dateKey: '2026-09-22', status: 'success' },
      { dateKey: '2026-09-23', status: 'failed' },
      { dateKey: '2026-09-24', status: 'success' },
      { dateKey: '2026-09-27', status: 'neutral' },
    ],
    ledger: [
      { type: 'task_reward', amount: 10 },
      { type: 'task_reward', amount: 10 },
      { type: 'streak_bonus', amount: 10 },
      { type: 'task_penalty', amount: -20 },
      // ventilation comptable d'une pénalité : ne doit pas être recomptée
      { type: 'debt_created', amount: 5 },
      { type: 'debt_repayment', amount: 5 },
    ],
    consequences: [
      { provider: 'credits', status: 'completed' },
      { provider: 'mandatory-proof', status: 'completed' },
      { provider: 'credits', status: 'cancelled' },
    ],
    pausedDates: new Set(['2026-09-25', '2026-09-26']),
  })

  it('calcule le taux de réussite sur les échéances clôturées uniquement', () => {
    expect(review.occurrences).toEqual({ total: 6, completed: 3, failed: 1, pending: 1, paused: 1, successRate: 75 })
  })

  it('compte les jours parfaits, échoués et en pause', () => {
    expect(review.days).toMatchObject({ perfect: 3, failed: 1, paused: 2 })
    expect(review.days.list.map(day => day.status))
      .toEqual(['success', 'success', 'failed', 'success', 'paused', 'paused', 'neutral'])
  })

  it('agrège les crédits sans recompter la dette', () => {
    expect(review.credits).toEqual({ gained: 30, lost: 20, net: 10 })
  })

  it('compte les conséquences déclenchées (hors annulées) par type', () => {
    expect(review.consequences).toEqual({ total: 2, byProvider: { 'credits': 1, 'mandatory-proof': 1 } })
  })

  it('donne la meilleure série de la semaine, la pause gelant les jours', () => {
    // 21-22 (2), coupé par l'échec du 23, puis 24 : série max = 2
    expect(review.bestStreak).toBe(2)
  })

  it('renvoie un taux nul sans échéance clôturée', () => {
    const empty = computeWeeklyReview({ week, occurrences: [], dailyResults: [], ledger: [], consequences: [], pausedDates: new Set() })
    expect(empty.occurrences.successRate).toBeNull()
    expect(empty.bestStreak).toBe(0)
  })
})

describe('buildWeeklyCsv', () => {
  it('produit un CSV UTF-8 avec BOM, trié par date, protégé contre les formules', () => {
    const csv = buildWeeklyCsv({
      occurrences: [{ dueDate: '2026-09-22', dueAt: new Date(), status: 'completed', title: '=SOMME(A1)', processedAt: null }],
      dailyResults: [],
      ledger: [{ type: 'task_penalty', amount: -20, reason: 'Échec, "quotidien"', createdAt: new Date('2026-09-21T22:30:00Z') }],
      consequences: [],
      pausedDates: new Set(),
    }, 'Europe/Paris')

    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.slice(1).trim().split('\r\n')
    expect(lines).toEqual([
      'date,type,libelle,statut,credits',
      // À date égale : échéances puis mouvements de crédits
      '2026-09-22,echeance,\'=SOMME(A1),completed,',
      // 22:30 UTC le 21 = 00:30 le 22 à Paris
      '2026-09-22,credit,"Échec, ""quotidien""",task_penalty,-20',
    ])
  })
})
