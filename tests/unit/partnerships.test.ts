import { describe, it, expect } from 'vitest'
import {
  PARTNER_HISTORY_DAYS,
  buildPartnerHistory,
  generateInviteToken,
  hashInviteToken,
  summarizePartnerDay,
} from '../../server/utils/partnerships'

const now = new Date('2026-09-28T12:00:00Z')
const later = new Date('2026-09-28T21:59:00Z')
const earlier = new Date('2026-09-28T08:00:00Z')

describe('summarizePartnerDay', () => {
  it('journée réussie quand tout est validé', () => {
    expect(summarizePartnerDay(
      [{ status: 'completed', dueAt: later }, { status: 'completed', dueAt: earlier }],
      { paused: false, now },
    )).toEqual({ status: 'success', total: 2, completed: 2 })
  })

  it('en cours tant que les échéances restantes ne sont pas dépassées', () => {
    expect(summarizePartnerDay(
      [{ status: 'completed', dueAt: earlier }, { status: 'pending', dueAt: later }],
      { paused: false, now },
    )).toEqual({ status: 'in_progress', total: 2, completed: 1 })
  })

  it('en retard dès qu’une échéance à faire est dépassée', () => {
    expect(summarizePartnerDay([{ status: 'pending', dueAt: earlier }], { paused: false, now }).status).toBe('late')
  })

  it('l’échec prime sur le reste', () => {
    expect(summarizePartnerDay(
      [{ status: 'failed', dueAt: earlier }, { status: 'completed', dueAt: later }],
      { paused: false, now },
    ).status).toBe('failed')
  })

  it('repos sans échéance, pause pendant une pause (échéances « skipped » ignorées)', () => {
    expect(summarizePartnerDay([], { paused: false, now }).status).toBe('rest')
    expect(summarizePartnerDay([{ status: 'skipped', dueAt: later }], { paused: true, now }))
      .toEqual({ status: 'paused', total: 0, completed: 0 })
  })
})

describe('buildPartnerHistory', () => {
  it(`renvoie les ${PARTNER_HISTORY_DAYS} jours précédents, jours de pause signalés`, () => {
    const history = buildPartnerHistory(
      '2026-09-28',
      [
        { dateKey: '2026-09-21', status: 'success' },
        { dateKey: '2026-09-22', status: 'failed' },
        { dateKey: '2026-09-23', status: 'neutral' },
      ],
      new Set(['2026-09-26', '2026-09-27']),
    )
    expect(history).toEqual([
      { date: '2026-09-21', status: 'success' },
      { date: '2026-09-22', status: 'failed' },
      { date: '2026-09-23', status: 'neutral' },
      { date: '2026-09-24', status: 'neutral' },
      { date: '2026-09-25', status: 'neutral' },
      { date: '2026-09-26', status: 'paused' },
      { date: '2026-09-27', status: 'paused' },
    ])
  })
})

describe('jetons d’invitation', () => {
  it('seule l’empreinte est stockée, et elle est déterministe', () => {
    const { token, hash } = generateInviteToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(hash).toBe(hashInviteToken(token))
    expect(hash).not.toContain(token)
    expect(generateInviteToken().token).not.toBe(token)
  })
})
