import { describe, it, expect } from 'vitest'
import { GRACE_MINUTES_CHOICES, expiresAt, isExpired, isInGracePeriod } from '../../server/utils/grace'

const dueAt = new Date('2026-09-28T21:59:00Z')
const at = (minutesAfterDue: number) => new Date(dueAt.getTime() + minutesAfterDue * 60_000)

describe('délai de grâce', () => {
  it('propose 0, 15, 30 et 60 minutes', () => {
    expect(GRACE_MINUTES_CHOICES).toEqual([0, 15, 30, 60])
  })

  it('sans grâce, l’échéance expire dès l’heure limite (comportement historique)', () => {
    expect(isExpired(dueAt, 0, at(-1))).toBe(false)
    expect(isExpired(dueAt, 0, at(0))).toBe(true)
    expect(isInGracePeriod(dueAt, 0, at(0))).toBe(false)
  })

  it('avec grâce, l’échec survient à heure limite + grâce (borne incluse)', () => {
    expect(expiresAt(dueAt, 60).toISOString()).toBe('2026-09-28T22:59:00.000Z')
    expect(isExpired(dueAt, 60, at(59))).toBe(false)
    expect(isExpired(dueAt, 60, at(60))).toBe(true)
    expect(isExpired(dueAt, 15, at(16))).toBe(true)
  })

  it('« en retard » dès l’heure limite, mais encore validable pendant la grâce', () => {
    expect(isInGracePeriod(dueAt, 30, at(-5))).toBe(false)
    expect(isInGracePeriod(dueAt, 30, at(0))).toBe(true)
    expect(isInGracePeriod(dueAt, 30, at(29))).toBe(true)
    expect(isInGracePeriod(dueAt, 30, at(30))).toBe(false)
  })

  it('une échéance à 23:59 avec 60 min de grâce n’est pas expirée à 00:30 le lendemain', () => {
    // 21:59 UTC = 23:59 à Paris ; 22:30 UTC = 00:30 le lendemain à Paris
    expect(isExpired(dueAt, 60, new Date('2026-09-28T22:30:00Z'))).toBe(false)
  })
})
