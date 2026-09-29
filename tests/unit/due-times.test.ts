import { describe, it, expect } from 'vitest'
import { presetsForCategory, slotForTime } from '#shared/due-time-slots'
import { goalCatalog } from '#shared/goal-templates'
import { MIN_SLOT_SAMPLES, computeSlotStats } from '../../server/utils/time-slots'
import { checkPostponable, postponeWeekStart } from '../../server/utils/postpone'

const TZ = 'Europe/Paris'

describe('créneaux', () => {
  it('classe les heures, bornes incluses au début du créneau', () => {
    expect(slotForTime('04:59')).toBe('night')
    expect(slotForTime('05:00')).toBe('morning')
    expect(slotForTime('11:00')).toBe('midday')
    expect(slotForTime('14:00')).toBe('afternoon')
    expect(slotForTime('18:00')).toBe('evening')
    expect(slotForTime('21:59')).toBe('evening')
    expect(slotForTime('23:59')).toBe('night')
  })
})

describe('presets par catégorie', () => {
  it('reconnaît une catégorie sans tenir compte des accents ni de la casse', () => {
    expect(presetsForCategory('Sport')).toEqual(['07:00', '12:30', '18:30'])
    expect(presetsForCategory('  bien-ÊTRE ')).toEqual(['07:30', '21:00'])
    expect(presetsForCategory('Réseaux sociaux')).toEqual(['09:00', '12:00', '18:00'])
    expect(presetsForCategory('Reading')).toEqual(['21:30', '22:30'])
  })

  it('ne propose rien pour une catégorie inconnue ou vide', () => {
    expect(presetsForCategory('Jardinage')).toEqual([])
    expect(presetsForCategory('')).toEqual([])
    expect(presetsForCategory(undefined)).toEqual([])
  })

  it('couvre toutes les catégories du catalogue de modèles, dans chaque langue', () => {
    for (const template of goalCatalog.templates) {
      for (const [locale, text] of Object.entries(template.locales)) {
        expect(presetsForCategory(text.category), `${template.id} (${locale}) : ${text.category}`).not.toEqual([])
      }
    }
  })
})

// 20 juin 2026 : heure d'été à Paris (UTC+2)
function at(localTime: string, status: 'completed' | 'failed' | 'skipped', day = 1) {
  const [h, m] = localTime.split(':').map(Number)
  return { plannedAt: new Date(Date.UTC(2026, 5, day, h! - 2, m!)), status }
}

describe('statistiques par créneau', () => {
  it('compte réussites et échecs à l’heure locale, sans les échéances en pause', () => {
    const { slots } = computeSlotStats([at('07:00', 'completed'), at('07:30', 'failed'), at('21:00', 'skipped')], TZ)
    expect(slots.find(s => s.slot === 'morning')).toMatchObject({ completed: 1, failed: 1, total: 2, rate: null })
    expect(slots.find(s => s.slot === 'evening')).toMatchObject({ total: 0 })
  })

  it(`ne calcule un taux qu’à partir de ${MIN_SLOT_SAMPLES} échéances`, () => {
    const rows = Array.from({ length: MIN_SLOT_SAMPLES }, (_, i) => at('08:00', i < 4 ? 'completed' : 'failed', i + 1))
    expect(computeSlotStats(rows, TZ).slots.find(s => s.slot === 'morning')!.rate).toBe(80)
    expect(computeSlotStats(rows.slice(1), TZ).slots.find(s => s.slot === 'morning')!.rate).toBeNull()
  })

  it('suggère le meilleur créneau et son heure la plus souvent réussie', () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, i) => at(i < 4 ? '07:00' : '08:00', 'completed', i + 1)),
      ...Array.from({ length: 6 }, (_, i) => at('23:59', i < 2 ? 'completed' : 'failed', i + 1)),
    ]
    expect(computeSlotStats(rows, TZ).suggestion).toEqual({ slot: 'morning', rate: 100, time: '07:00' })
  })

  it('ne suggère rien avec un seul créneau comparable', () => {
    const rows = Array.from({ length: 10 }, (_, i) => at('07:00', 'completed', i + 1))
    expect(computeSlotStats(rows, TZ).suggestion).toBeNull()
  })
})

describe('report d’un jour', () => {
  const now = new Date('2026-09-29T10:00:00Z')
  const pending = { status: 'pending', dueAt: new Date('2026-09-29T21:59:00Z'), originalDueAt: null }

  it('accepte une échéance à faire, pas encore expirée', () => {
    expect(checkPostponable(pending, 0, now)).toBeNull()
  })

  it('accepte une échéance en retard mais encore dans sa grâce', () => {
    const late = { ...pending, dueAt: new Date('2026-09-29T09:50:00Z') }
    expect(checkPostponable(late, 30, now)).toBeNull()
    expect(checkPostponable(late, 0, now)).toBe('expired')
  })

  it('refuse une échéance déjà traitée ou déjà reportée', () => {
    expect(checkPostponable({ ...pending, status: 'failed' }, 0, now)).toBe('not_pending')
    expect(checkPostponable({ ...pending, status: 'completed' }, 0, now)).toBe('not_pending')
    expect(checkPostponable({ ...pending, originalDueAt: new Date() }, 0, now)).toBe('already_postponed')
  })

  it('compte le quota par semaine ISO dans le fuseau de l’utilisateur', () => {
    // Dimanche 23:30 à Paris = dimanche 21:30 UTC : encore la semaine du lundi 28 septembre
    expect(postponeWeekStart(TZ, new Date('2026-10-04T21:30:00Z'))).toBe('2026-09-28')
    // Lundi 00:30 à Paris : nouvelle semaine
    expect(postponeWeekStart(TZ, new Date('2026-10-04T22:30:00Z'))).toBe('2026-10-05')
  })
})
