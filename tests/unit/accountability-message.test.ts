import { describe, it, expect, vi, beforeEach } from 'vitest'

// Le worker lit l'URL publique dans APP_URL (hors Nitro)
const state = vi.hoisted(() => (process.env.APP_URL = 'https://focus.test/', {
  contact: null as null | { id: string, email: string, status: string, manageToken: string, lastMessageDate: string | null },
  reserved: true,
  context: { userName: 'Zoé', timezone: 'Europe/Paris', goalTitle: 'Courir', dueDate: '2026-10-12' } as Record<string, string> | undefined,
}))

vi.mock('../../server/utils/mailer', () => ({
  isMailerConfigured: vi.fn(() => true),
  sendMail: vi.fn(async () => ({ messageId: 'm-1' })),
}))

vi.mock('../../server/utils/occurrences', () => ({
  getTodayInTimezone: vi.fn(() => '2026-10-12'),
}))

vi.mock('../../server/utils/accountability', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/utils/accountability')>()
  return {
    ...actual,
    getContactForUser: vi.fn(async () => state.contact),
    reserveDailyMessage: vi.fn(async () => state.reserved),
    releaseDailyMessage: vi.fn(async () => {}),
  }
})

vi.mock('../../server/database', () => {
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    limit: async () => (state.context ? [state.context] : []),
  }
  return {
    useDatabase: () => ({ select: () => chain }),
    schema: new Proxy({}, { get: () => new Proxy({}, { get: (_, key) => String(key) }) }),
  }
})

import { accountabilityMessageProvider } from '../../server/consequences/providers/accountability-message'
import { getConsequenceProvider } from '../../server/consequences/registry'
import { DEFAULT_ACCOUNTABILITY_TEMPLATE } from '../../server/consequences/types'
import { buildInvitationEmail, formatDayMonth, releaseDailyMessage, renderAccountabilityTemplate, reserveDailyMessage } from '../../server/utils/accountability'
import { isMailerConfigured, sendMail } from '../../server/utils/mailer'

const config = { contactEmail: 'ami@focus.test', contactName: 'Sam', message: DEFAULT_ACCOUNTABILITY_TEMPLATE, userConsent: true as const }
const payload = { historyId: 'h-1', userId: 'u-1', goalId: 'g-1', occurrenceId: 'o-1', amount: 0, config }
const confirmed = { id: 'c-1', email: 'ami@focus.test', status: 'confirmed', manageToken: 'tok', lastMessageDate: '2026-10-10' }

describe('accountability-message : validation', () => {
  it('est enregistré dans le registre', () => {
    expect(getConsequenceProvider('accountability-message')).toBe(accountabilityMessageProvider)
  })

  it('normalise l’email et applique le message par défaut', async () => {
    const parsed = await accountabilityMessageProvider.validate({ contactEmail: '  Ami@Focus.TEST ', userConsent: true })
    expect(parsed).toEqual({ contactEmail: 'ami@focus.test', contactName: '', message: DEFAULT_ACCOUNTABILITY_TEMPLATE, userConsent: true })
  })

  it('exige le consentement de l’utilisateur (premier opt-in) et un email valide', async () => {
    await expect(accountabilityMessageProvider.validate({ contactEmail: 'ami@focus.test' })).rejects.toThrow()
    await expect(accountabilityMessageProvider.validate({ contactEmail: 'ami@focus.test', userConsent: false })).rejects.toThrow()
    await expect(accountabilityMessageProvider.validate({ contactEmail: 'pas-un-email', userConsent: true })).rejects.toThrow()
    await expect(accountabilityMessageProvider.validate({ ...config, message: 'x'.repeat(501) })).rejects.toThrow()
  })
})

describe('accountability-message : message', () => {
  it('remplace les variables et formate la date en JJ/MM', () => {
    expect(formatDayMonth('2026-10-02')).toBe('02/10')
    expect(renderAccountabilityTemplate(DEFAULT_ACCOUNTABILITY_TEMPLATE, { name: 'Zoé', goal: 'Courir', date: '02/10' }))
      .toBe('Zoé n\'a pas tenu son engagement « Courir » du 02/10.')
    expect(renderAccountabilityTemplate('{nom} {nom} {autre}', { name: 'Zoé', goal: '', date: '' })).toBe('Zoé Zoé {autre}')
  })

  it('invite le contact avec un lien pour accepter ou refuser', () => {
    const mail = buildInvitationEmail({ userName: 'Zoé', contactName: 'Sam', token: 'tok' })
    expect(mail.subject).toContain('Zoé')
    expect(mail.text).toContain('Bonjour Sam,')
    expect(mail.text).toContain('/contact/tok')
    expect(mail.text).toContain('Rien ne vous sera envoyé sans votre accord')
  })
})

describe('accountability-message : exécution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.contact = { ...confirmed }
    state.reserved = true
    vi.mocked(isMailerConfigured).mockReturnValue(true)
  })

  it('envoie « X n’a pas tenu son engagement du JJ/MM » au contact confirmé, avec désinscription', async () => {
    const result = await accountabilityMessageProvider.execute(payload)

    expect(reserveDailyMessage).toHaveBeenCalledWith('c-1', '2026-10-12')
    expect(sendMail).toHaveBeenCalledTimes(1)
    const mail = vi.mocked(sendMail).mock.calls[0]![0]
    expect(mail.to).toBe('ami@focus.test')
    expect(mail.subject).toBe('Zoé n\'a pas tenu son engagement du 12/10')
    expect(mail.text).toContain('Zoé n\'a pas tenu son engagement « Courir » du 12/10.')
    expect(mail.text).toContain('Ne plus recevoir ces messages : https://focus.test/contact/tok')
    expect(mail.unsubscribeUrl).toBe('https://focus.test/contact/tok')
    expect(result).toEqual({ sent: true, contactId: 'c-1', date: '12/10' })
  })

  it('n’envoie rien tant que le contact n’a pas accepté (second opt-in)', async () => {
    state.contact = { ...confirmed, status: 'pending' }
    expect(await accountabilityMessageProvider.execute(payload)).toEqual({ skipped: true, reason: 'contact_not_confirmed' })
    state.contact = null
    expect(await accountabilityMessageProvider.execute(payload)).toEqual({ skipped: true, reason: 'contact_not_confirmed' })
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('n’envoie rien à un contact qui a refusé ou s’est désinscrit', async () => {
    state.contact = { ...confirmed, status: 'declined' }
    expect(await accountabilityMessageProvider.execute(payload)).toEqual({ skipped: true, reason: 'contact_declined' })
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('limite à un message par jour et par contact', async () => {
    state.reserved = false
    expect(await accountabilityMessageProvider.execute(payload)).toEqual({ skipped: true, reason: 'daily_limit', contactId: 'c-1' })
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('ignore le message si l’instance n’a pas d’envoi d’email', async () => {
    vi.mocked(isMailerConfigured).mockReturnValue(false)
    expect(await accountabilityMessageProvider.execute(payload)).toEqual({ skipped: true, reason: 'mailer_not_configured' })
    expect(reserveDailyMessage).not.toHaveBeenCalled()
  })

  it('libère la réservation du jour si l’envoi échoue, pour la nouvelle tentative du worker', async () => {
    vi.mocked(sendMail).mockRejectedValueOnce(new Error('SMTP indisponible'))
    await expect(accountabilityMessageProvider.execute(payload)).rejects.toThrow('SMTP indisponible')
    expect(releaseDailyMessage).toHaveBeenCalledWith('c-1', '2026-10-12', '2026-10-10')
  })
})
