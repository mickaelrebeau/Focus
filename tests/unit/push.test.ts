import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const tables = vi.hoisted(() => ({
  pushSubscriptions: { __name: 'push_subscriptions', id: 'ps.id', userId: 'ps.user_id' },
  notificationPreferences: { __name: 'notification_preferences', userId: 'np.user_id' },
  pushDeliveries: { __name: 'push_deliveries', id: 'pd.id' },
}))

const db = vi.hoisted(() => ({
  subscriptions: [] as Array<{ id: string, endpoint: string, p256dh: string, auth: string }>,
  preferences: null as Record<string, unknown> | null,
  deliveryInserted: true,
  deletedSubscriptions: [] as unknown[],
  deletedDeliveries: 0,
  deliveryUpdates: [] as unknown[],
}))

const sendNotification = vi.hoisted(() => vi.fn())

vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification },
}))

vi.mock('../../server/database', () => ({
  schema: tables,
  useDatabase: () => ({
    select: () => ({
      from: (table: { __name: string }) => ({
        where: () => {
          const rows = table.__name === 'push_subscriptions' ? db.subscriptions : db.preferences ? [db.preferences] : []
          return Object.assign(Promise.resolve(rows), { limit: async () => rows })
        },
      }),
    }),
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: async () => (db.deliveryInserted ? [{ id: 'delivery-1' }] : []),
        }),
      }),
    }),
    update: (table: { __name: string }) => ({
      set: (values: unknown) => ({
        where: async () => {
          if (table.__name === 'push_deliveries') db.deliveryUpdates.push(values)
        },
      }),
    }),
    delete: (table: { __name: string }) => ({
      where: async (condition: unknown) => {
        if (table.__name === 'push_subscriptions') db.deletedSubscriptions.push(condition)
        else db.deletedDeliveries++
      },
    }),
  }),
}))

import {
  consequenceDetail,
  isReminderDue,
  isStreakRiskWindow,
  pushMessages,
  sendPushToUser,
} from '../../server/utils/push'

const payload = () => ({ title: 'T', body: 'B' })

describe('helpers', () => {
  const now = new Date('2026-09-28T10:00:00Z')

  it('isReminderDue : dans la fenêtre, pas avant, jamais après l’échéance', () => {
    expect(isReminderDue(new Date('2026-09-28T10:45:00Z'), 60, now)).toBe(true)
    expect(isReminderDue(new Date('2026-09-28T11:00:00Z'), 60, now)).toBe(true)
    expect(isReminderDue(new Date('2026-09-28T11:01:00Z'), 60, now)).toBe(false)
    expect(isReminderDue(new Date('2026-09-28T09:59:00Z'), 60, now)).toBe(false)
  })

  it('isStreakRiskWindow : à partir de 20 h dans le fuseau de l’utilisateur', () => {
    // 18:30 UTC = 20:30 à Paris (UTC+2 en septembre), 14:30 à New York
    const evening = new Date('2026-09-28T18:30:00Z')
    expect(isStreakRiskWindow('Europe/Paris', evening)).toBe(true)
    expect(isStreakRiskWindow('America/New_York', evening)).toBe(false)
  })

  it('messages traduits et détail des conséquences', () => {
    expect(pushMessages('fr').dueReminder('Lire', 30).body).toBe('« Lire » arrive à échéance dans 30 min.')
    expect(pushMessages('en').dueReminder('Read', 120).body).toBe('“Read” is due in 2 hours.')
    expect(consequenceDetail('credits', 20, {}, 'fr')).toBe('-20 crédits')
    expect(consequenceDetail('custom', 0, { message: 'Faire 100 pompes' }, 'en')).toBe('Faire 100 pompes')
  })
})

describe('sendPushToUser', () => {
  beforeEach(() => {
    vi.stubEnv('VAPID_PUBLIC_KEY', 'public-key')
    vi.stubEnv('VAPID_PRIVATE_KEY', 'private-key')
    vi.stubEnv('VAPID_SUBJECT', 'mailto:admin@example.org')
    sendNotification.mockReset()
    sendNotification.mockResolvedValue({ statusCode: 201 })
    db.subscriptions = [{ id: 'sub-1', endpoint: 'https://push.example/1', p256dh: 'p', auth: 'a' }]
    db.preferences = null
    db.deliveryInserted = true
    db.deletedSubscriptions = []
    db.deletedDeliveries = 0
    db.deliveryUpdates = []
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('n’envoie rien si le serveur n’a pas de clés VAPID', async () => {
    vi.stubEnv('VAPID_PRIVATE_KEY', '')
    expect(await sendPushToUser('u1', 'due_reminder', 'occ-1', payload)).toEqual({ sent: 0, skipped: 'not_configured' })
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it('n’envoie rien sans abonnement (pas de consentement)', async () => {
    db.subscriptions = []
    expect(await sendPushToUser('u1', 'due_reminder', 'occ-1', payload)).toEqual({ sent: 0, skipped: 'no_subscription' })
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it('respecte une préférence désactivée', async () => {
    db.preferences = { userId: 'u1', dueReminder: false, locale: 'fr' }
    expect(await sendPushToUser('u1', 'due_reminder', 'occ-1', payload)).toEqual({ sent: 0, skipped: 'disabled' })
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it('ne renvoie pas un événement déjà notifié', async () => {
    db.deliveryInserted = false
    expect(await sendPushToUser('u1', 'due_reminder', 'occ-1', payload)).toEqual({ sent: 0, skipped: 'already_sent' })
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it('envoie à chaque appareil, supprime les abonnements expirés et journalise l’envoi', async () => {
    db.subscriptions.push({ id: 'sub-2', endpoint: 'https://push.example/2', p256dh: 'p', auth: 'a' })
    sendNotification
      .mockResolvedValueOnce({ statusCode: 201 })
      .mockRejectedValueOnce(Object.assign(new Error('Gone'), { statusCode: 410 }))

    const result = await sendPushToUser('u1', 'due_reminder', 'occ-1', locale => pushMessages(locale).test())

    expect(result).toEqual({ sent: 1, removed: 1 })
    expect(sendNotification).toHaveBeenCalledTimes(2)
    expect(JSON.parse(sendNotification.mock.calls[0]![1])).toMatchObject({ title: 'Notifications activées' })
    expect(db.deletedSubscriptions).toHaveLength(1)
    expect(db.deliveryUpdates).toEqual([{ sentCount: 1 }])
  })

  it('libère la clé de déduplication si rien n’a pu être envoyé', async () => {
    sendNotification.mockRejectedValue(Object.assign(new Error('Server error'), { statusCode: 500 }))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await sendPushToUser('u1', 'due_reminder', 'occ-1', payload)).toEqual({ sent: 0, removed: 0 })
    expect(db.deletedDeliveries).toBe(1)
    expect(db.deletedSubscriptions).toHaveLength(0)
    error.mockRestore()
  })

  it('le test ignore les préférences et la déduplication', async () => {
    db.preferences = { userId: 'u1', dueReminder: false, streakAtRisk: false, locale: 'en' }
    db.deliveryInserted = false

    const result = await sendPushToUser('u1', 'test', 'test-1', locale => pushMessages(locale).test())

    expect(result).toEqual({ sent: 1, removed: 0 })
    expect(JSON.parse(sendNotification.mock.calls[0]![1])).toMatchObject({ title: 'Notifications enabled' })
  })
})
