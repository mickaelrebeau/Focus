import { describe, it, expect } from 'vitest'
import { isSecretKey, redactSecrets } from '../../server/utils/account-export'
import { DEFAULT_PURGE_DELAY_DAYS, purgeDate, purgeDelayDays } from '../../server/utils/account-deletion'

describe('redactSecrets', () => {
  it('retire les secrets, y compris dans les champs JSON imbriqués', () => {
    const exported = redactSecrets({
      email: 'a@focus.test',
      passwordHash: 'x',
      invite_token_hash: 'x',
      metadata: { paymentIntentId: 'pi_1', stripe_customer_id: 'cus_1', reason: 'échec' },
      devices: [{ p256dh: 'k', auth: 'k', userAgent: 'Firefox' }],
      googleId: '123',
    })
    expect(exported).toEqual({
      email: 'a@focus.test',
      metadata: { reason: 'échec' },
      devices: [{ userAgent: 'Firefox' }],
    })
  })

  it('garde les dates et les valeurs simples', () => {
    const createdAt = new Date('2026-09-29T10:00:00Z')
    expect(redactSecrets({ createdAt, amount: 0, note: null })).toEqual({ createdAt, amount: 0, note: null })
  })

  it('ne confond pas une clé ordinaire avec un secret', () => {
    for (const key of ['authorName', 'goalId', 'status', 'proofUrl', 'reviewNote']) {
      expect(isSecretKey(key)).toBe(false)
    }
  })
})

describe('purge des comptes supprimés', () => {
  it(`attend ${DEFAULT_PURGE_DELAY_DAYS} jours par défaut`, () => {
    expect(purgeDelayDays(undefined)).toBe(DEFAULT_PURGE_DELAY_DAYS)
    expect(purgeDelayDays('')).toBe(DEFAULT_PURGE_DELAY_DAYS)
  })

  it('accepte 0 (purge au passage suivant) et ignore une valeur invalide', () => {
    expect(purgeDelayDays('0')).toBe(0)
    expect(purgeDelayDays('7')).toBe(7)
    expect(purgeDelayDays('-1')).toBe(DEFAULT_PURGE_DELAY_DAYS)
    expect(purgeDelayDays('1.5')).toBe(DEFAULT_PURGE_DELAY_DAYS)
    expect(purgeDelayDays('abc')).toBe(DEFAULT_PURGE_DELAY_DAYS)
  })

  it('calcule la date de purge', () => {
    expect(purgeDate(new Date('2026-09-29T10:00:00Z'), 30).toISOString()).toBe('2026-10-29T10:00:00.000Z')
  })
})
