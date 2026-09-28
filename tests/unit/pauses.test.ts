import { describe, it, expect } from 'vitest'
import {
  MAX_PAUSE_DAYS,
  expandPauseDates,
  isDateInPauses,
  pauseStatus,
  rangesOverlap,
  validatePauseRange,
} from '../../server/utils/pauses'
import { calculateStreaksFromDates, resolveStreakFromDailyResults } from '../../server/utils/streaks'

const today = '2026-09-28'

describe('validatePauseRange', () => {
  it('accepte une pause qui commence aujourd’hui', () => {
    expect(validatePauseRange({ startDate: today, endDate: '2026-10-05' }, today)).toBeNull()
  })

  it('refuse une pause rétroactive', () => {
    expect(validatePauseRange({ startDate: '2026-09-27', endDate: '2026-10-05' }, today)).toBe('start_in_past')
  })

  it('refuse une fin avant le début', () => {
    expect(validatePauseRange({ startDate: '2026-10-05', endDate: '2026-10-01' }, today)).toBe('end_before_start')
  })

  it(`limite la durée à ${MAX_PAUSE_DAYS} jours, bornes incluses`, () => {
    expect(validatePauseRange({ startDate: '2026-10-01', endDate: '2026-11-29' }, today)).toBeNull() // 60 jours
    expect(validatePauseRange({ startDate: '2026-10-01', endDate: '2026-11-30' }, today)).toBe('too_long') // 61 jours
  })
})

describe('périodes', () => {
  it('détecte les chevauchements, bornes incluses', () => {
    const pause = { startDate: '2026-10-01', endDate: '2026-10-05' }
    expect(rangesOverlap(pause, { startDate: '2026-10-05', endDate: '2026-10-08' })).toBe(true)
    expect(rangesOverlap(pause, { startDate: '2026-10-06', endDate: '2026-10-08' })).toBe(false)
  })

  it('calcule le statut d’une pause', () => {
    const pause = { startDate: '2026-10-01', endDate: '2026-10-05', cancelledAt: null }
    expect(pauseStatus(pause, '2026-09-30')).toBe('upcoming')
    expect(pauseStatus(pause, '2026-10-01')).toBe('active')
    expect(pauseStatus(pause, '2026-10-05')).toBe('active')
    expect(pauseStatus(pause, '2026-10-06')).toBe('ended')
    expect(pauseStatus({ ...pause, cancelledAt: new Date() }, '2026-10-03')).toBe('cancelled')
  })

  it('liste les jours gelés et teste l’appartenance', () => {
    const pauses = [{ startDate: '2026-09-30', endDate: '2026-10-02' }]
    expect([...expandPauseDates(pauses)]).toEqual(['2026-09-30', '2026-10-01', '2026-10-02'])
    expect(isDateInPauses('2026-10-01', pauses)).toBe(true)
    expect(isDateInPauses('2026-10-03', pauses)).toBe(false)
  })
})

describe('streak gelé pendant une pause', () => {
  // Lun 21, Mar 22 réussis ; pause du mer 23 au ven 25 ; sam 26, dim 27 réussis
  const frozen = expandPauseDates([{ startDate: '2026-09-23', endDate: '2026-09-25' }])
  const successDays = ['2026-09-21', '2026-09-22', '2026-09-26', '2026-09-27']

  it('sans pause, un trou dans les jours réussis casse le streak', () => {
    expect(calculateStreaksFromDates(successDays).current).toBe(2)
  })

  it('la pause ne casse pas le streak et ne le prolonge pas', () => {
    // 4 jours réussis, pas 7 : les 3 jours de pause ne comptent pas
    expect(calculateStreaksFromDates(successDays, frozen)).toEqual({ current: 4, longest: 4, lastDate: '2026-09-27' })
  })

  it('un jour non gelé manqué entre deux réussites casse toujours le streak', () => {
    const withGap = ['2026-09-21', '2026-09-22', '2026-09-27']
    // 26 n'est ni réussi ni en pause
    expect(calculateStreaksFromDates(withGap, frozen).current).toBe(1)
  })

  it('un échec après la pause remet toujours le streak courant à zéro', () => {
    const result = resolveStreakFromDailyResults([
      { dateKey: '2026-09-21', status: 'success' },
      { dateKey: '2026-09-22', status: 'success' },
      { dateKey: '2026-09-26', status: 'failed' },
    ], frozen)
    expect(result.currentStreak).toBe(0)
    expect(result.longestStreak).toBe(2)
  })

  it('la pause en cours conserve le streak acquis avant elle', () => {
    const result = resolveStreakFromDailyResults([
      { dateKey: '2026-09-21', status: 'success' },
      { dateKey: '2026-09-22', status: 'success' },
      // jours de pause : neutres (échéances « skipped »)
      { dateKey: '2026-09-23', status: 'neutral' },
    ], frozen)
    expect(result).toEqual({ currentStreak: 2, longestStreak: 2, lastSuccessDate: '2026-09-22' })
  })
})
