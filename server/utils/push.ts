import webpush from 'web-push'
import { and, eq, gt, inArray, sql } from 'drizzle-orm'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { useDatabase, schema } from '../database'

export type PushKind = 'due_reminder' | 'streak_at_risk' | 'consequence_executed' | 'milestone_bonus' | 'challenge_closed' | 'test'
export type PushLocale = 'fr' | 'en'

export interface PushPayload {
  title: string
  body: string
  /** Page ouverte au clic sur la notification */
  url?: string
  /** Une notification portant le même tag remplace la précédente sur l'appareil */
  tag?: string
}

export const REMINDER_MINUTES_CHOICES = [15, 30, 60, 120, 240] as const
export const STREAK_RISK_HOUR = 20

const PREFERENCE_BY_KIND = {
  due_reminder: 'dueReminder',
  streak_at_risk: 'streakAtRisk',
  consequence_executed: 'consequenceExecuted',
  milestone_bonus: 'milestoneBonus',
  challenge_closed: 'challengeResults',
} as const

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  dueReminder: true,
  dueReminderMinutes: 60,
  streakAtRisk: true,
  consequenceExecuted: true,
  milestoneBonus: true,
  challengeResults: true,
  locale: 'fr' as PushLocale,
}

// Clés VAPID lues au lancement (process.env), et non via runtimeConfig qui serait figé
// au build : le web comme les workers doivent pouvoir les recevoir au démarrage.
function readVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || process.env.APP_URL
  if (!publicKey || !privateKey || !subject) return null
  return { publicKey, privateKey, subject }
}

export function getVapidPublicKey() {
  return readVapidConfig()?.publicKey ?? null
}

let appliedVapidKey: string | null = null

function ensureVapidConfigured() {
  const config = readVapidConfig()
  if (!config) return false
  if (appliedVapidKey !== config.publicKey) {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)
    appliedVapidKey = config.publicKey
  }
  return true
}

export function normalizePushLocale(value: unknown): PushLocale {
  return value === 'en' ? 'en' : 'fr'
}

/** Rappel dû : l'échéance n'est pas passée et commence dans moins de `minutes`. */
export function isReminderDue(dueAt: Date, minutes: number, now = new Date()) {
  const remaining = dueAt.getTime() - now.getTime()
  return remaining > 0 && remaining <= minutes * 60_000
}

/** Le soir (à partir de STREAK_RISK_HOUR, heure locale), un jour encore ouvert menace le streak. */
export function isStreakRiskWindow(timezone: string, now = new Date()) {
  return toZonedTime(now, timezone).getHours() >= STREAK_RISK_HOUR
}

export function localDateKey(timezone: string, now = new Date()) {
  return format(toZonedTime(now, timezone), 'yyyy-MM-dd')
}

const MESSAGES = {
  fr: {
    dueReminder: (title: string, minutes: number) => ({
      title: 'Échéance bientôt',
      body: `« ${title} » arrive à échéance dans ${formatDuration(minutes, 'fr')}.`,
    }),
    streakAtRisk: (streak: number, pending: number) => ({
      title: `Streak de ${streak} jour${streak > 1 ? 's' : ''} en danger`,
      body: `Encore ${pending} échéance${pending > 1 ? 's' : ''} à valider aujourd'hui pour garder votre série.`,
    }),
    consequenceExecuted: (detail: string) => ({
      title: 'Conséquence appliquée',
      body: `Un objectif a été manqué : ${detail}.`,
    }),
    milestoneBonus: (milestone: number, bonus: number) => ({
      title: `${milestone} jours parfaits d'affilée !`,
      body: `Bonus de ${bonus} crédits ajouté à votre portefeuille.`,
    }),
    challengeClosed: (name: string, rank: number | null, payout: number) => ({
      title: 'Défi terminé',
      body: rank === null
        ? `Le défi « ${name} » est annulé faute de participants. Votre mise est remboursée.`
        : `Le défi « ${name} » est terminé : vous finissez ${rank === 1 ? '1er' : `${rank}e`}${payout > 0 ? ` et gagnez ${payout} crédits` : ''}.`,
    }),
    test: () => ({
      title: 'Notifications activées',
      body: 'Vous recevrez vos rappels Focus sur cet appareil.',
    }),
  },
  en: {
    dueReminder: (title: string, minutes: number) => ({
      title: 'Deadline coming up',
      body: `“${title}” is due in ${formatDuration(minutes, 'en')}.`,
    }),
    streakAtRisk: (streak: number, pending: number) => ({
      title: `Your ${streak}-day streak is at risk`,
      body: `${pending} deadline${pending > 1 ? 's' : ''} left to check in today to keep your streak.`,
    }),
    consequenceExecuted: (detail: string) => ({
      title: 'Consequence applied',
      body: `A goal was missed: ${detail}.`,
    }),
    milestoneBonus: (milestone: number, bonus: number) => ({
      title: `${milestone} perfect days in a row!`,
      body: `A ${bonus}-credit bonus was added to your wallet.`,
    }),
    challengeClosed: (name: string, rank: number | null, payout: number) => ({
      title: 'Challenge over',
      body: rank === null
        ? `“${name}” was cancelled (not enough participants). Your stake is refunded.`
        : `“${name}” is over: you finished #${rank}${payout > 0 ? ` and won ${payout} credits` : ''}.`,
    }),
    test: () => ({
      title: 'Notifications enabled',
      body: 'You will receive your Focus reminders on this device.',
    }),
  },
} as const

export function pushMessages(locale: PushLocale) {
  return MESSAGES[locale]
}

/** Détail lisible d'une conséquence exécutée, pour le corps de la notification. */
export function consequenceDetail(
  provider: string,
  amount: number,
  config: Record<string, unknown>,
  locale: PushLocale,
) {
  const euros = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { style: 'currency', currency: 'EUR' })
    .format(amount / 100)
  const fr = locale === 'fr'
  switch (provider) {
    case 'credits': return fr ? `-${amount} crédits` : `-${amount} credits`
    case 'random-user': return fr ? `${amount} crédits transférés à un autre utilisateur` : `${amount} credits transferred to another user`
    case 'donation': return fr ? `don de ${euros}` : `${euros} donation`
    case 'stripe': return fr ? `prélèvement de ${euros}` : `${euros} charge`
    case 'mandatory-proof': return fr ? 'preuve obligatoire à la prochaine réussite' : 'proof required on your next check-in'
    case 'custom': return String(config.message ?? (fr ? 'rappel personnalisé' : 'custom reminder'))
    default: return provider
  }
}

function formatDuration(minutes: number, locale: PushLocale) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (locale === 'fr') return `${hours} heure${hours > 1 ? 's' : ''}`
  return `${hours} hour${hours > 1 ? 's' : ''}`
}

export async function getNotificationPreferences(userId: string) {
  const db = useDatabase()
  const [row] = await db
    .select()
    .from(schema.notificationPreferences)
    .where(eq(schema.notificationPreferences.userId, userId))
    .limit(1)

  return row
    ? { ...row, locale: normalizePushLocale(row.locale) }
    : { userId, ...DEFAULT_NOTIFICATION_PREFERENCES, updatedAt: null }
}

export type PushSendResult =
  | { sent: number, removed: number }
  | { sent: 0, skipped: 'not_configured' | 'no_subscription' | 'disabled' | 'already_sent' }

/**
 * Envoie une notification à tous les appareils abonnés d'un utilisateur.
 * - Aucun envoi sans abonnement : l'abonnement est le consentement explicite.
 * - Chaque type respecte la préférence correspondante (sauf `test`, déclenché par l'utilisateur).
 * - `refKey` déduplique : un même événement n'est notifié qu'une fois (`push_deliveries`).
 */
export async function sendPushToUser(
  userId: string,
  kind: PushKind,
  refKey: string,
  buildPayload: (locale: PushLocale) => PushPayload,
): Promise<PushSendResult> {
  if (!ensureVapidConfigured()) return { sent: 0, skipped: 'not_configured' }

  const db = useDatabase()
  const subscriptions = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, userId))

  if (subscriptions.length === 0) return { sent: 0, skipped: 'no_subscription' }

  const preferences = await getNotificationPreferences(userId)
  if (kind !== 'test' && !preferences[PREFERENCE_BY_KIND[kind]]) {
    return { sent: 0, skipped: 'disabled' }
  }

  let deliveryId: string | null = null
  if (kind !== 'test') {
    const [delivery] = await db
      .insert(schema.pushDeliveries)
      .values({ userId, kind, refKey })
      .onConflictDoNothing()
      .returning({ id: schema.pushDeliveries.id })
    if (!delivery) return { sent: 0, skipped: 'already_sent' }
    deliveryId = delivery.id
  }

  const payload = JSON.stringify(buildPayload(preferences.locale))
  let sent = 0
  const expiredIds: string[] = []

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        payload,
        { TTL: 60 * 60 },
      )
      sent++
      await db
        .update(schema.pushSubscriptions)
        .set({ lastSuccessAt: new Date() })
        .where(eq(schema.pushSubscriptions.id, subscription.id))
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode
      // 404 / 410 : l'abonnement n'existe plus côté navigateur
      if (statusCode === 404 || statusCode === 410) {
        expiredIds.push(subscription.id)
      } else {
        console.error(`[push] Échec d'envoi ${kind} user=${userId}:`, (error as Error).message)
      }
    }
  }

  if (expiredIds.length) {
    await db.delete(schema.pushSubscriptions).where(inArray(schema.pushSubscriptions.id, expiredIds))
  }

  if (deliveryId) {
    if (sent > 0) {
      await db.update(schema.pushDeliveries).set({ sentCount: sent }).where(eq(schema.pushDeliveries.id, deliveryId))
    } else {
      // Rien n'est parti : on libère la clé pour réessayer au prochain passage
      await db.delete(schema.pushDeliveries).where(eq(schema.pushDeliveries.id, deliveryId))
    }
  }

  return { sent, removed: expiredIds.length }
}

/** À appeler depuis un flux métier : une erreur d'envoi ne doit jamais le faire échouer. */
export async function notifySafely(...args: Parameters<typeof sendPushToUser>) {
  try {
    return await sendPushToUser(...args)
  } catch (error) {
    console.error('[push] Notification ignorée :', (error as Error).message)
    return null
  }
}

/**
 * Rappels planifiés (worker deadlines, toutes les 5 minutes) :
 * - échéance proche, selon le délai choisi par l'utilisateur ;
 * - streak en danger le soir, si des échéances du jour restent à valider.
 */
export async function processPushReminders(now = new Date()) {
  if (!readVapidConfig()) return { configured: false, reminders: 0, streakWarnings: 0 }

  const db = useDatabase()
  const hasSubscription = sql`EXISTS (SELECT 1 FROM ${schema.pushSubscriptions} WHERE ${schema.pushSubscriptions.userId} = ${schema.occurrences.userId})`

  const upcoming = await db
    .select({
      occurrenceId: schema.occurrences.id,
      userId: schema.occurrences.userId,
      dueAt: schema.occurrences.dueAt,
      originalDueAt: schema.occurrences.originalDueAt,
      title: schema.goals.title,
      minutes: schema.notificationPreferences.dueReminderMinutes,
    })
    .from(schema.occurrences)
    .innerJoin(schema.goals, eq(schema.goals.id, schema.occurrences.goalId))
    .innerJoin(schema.notificationPreferences, eq(schema.notificationPreferences.userId, schema.occurrences.userId))
    .where(and(
      eq(schema.occurrences.status, 'pending'),
      eq(schema.goals.isActive, true),
      eq(schema.notificationPreferences.dueReminder, true),
      gt(schema.occurrences.dueAt, now),
      sql`${schema.occurrences.dueAt} <= ${now.toISOString()}::timestamptz + ${schema.notificationPreferences.dueReminderMinutes} * interval '1 minute'`,
      hasSubscription,
    ))

  let reminders = 0
  for (const row of upcoming) {
    if (!isReminderDue(row.dueAt, row.minutes, now)) continue
    const minutesLeft = Math.max(1, Math.round((row.dueAt.getTime() - now.getTime()) / 60_000))
    // Échéance reportée : nouveau rappel avant la nouvelle heure limite
    const refKey = row.originalDueAt ? `${row.occurrenceId}:postponed` : row.occurrenceId
    const result = await notifySafely(row.userId, 'due_reminder', refKey, locale => ({
      ...pushMessages(locale).dueReminder(row.title, minutesLeft),
      url: '/app',
      tag: `due-${row.occurrenceId}`,
    }))
    if (result && result.sent > 0) reminders++
  }

  const streakCandidates = await db
    .select({
      userId: schema.users.id,
      timezone: schema.users.timezone,
      currentStreak: schema.userStreaks.currentStreak,
    })
    .from(schema.users)
    .innerJoin(schema.userStreaks, eq(schema.userStreaks.userId, schema.users.id))
    .innerJoin(schema.notificationPreferences, eq(schema.notificationPreferences.userId, schema.users.id))
    .where(and(
      eq(schema.users.isBlocked, false),
      eq(schema.notificationPreferences.streakAtRisk, true),
      gt(schema.userStreaks.currentStreak, 0),
      sql`EXISTS (SELECT 1 FROM ${schema.pushSubscriptions} WHERE ${schema.pushSubscriptions.userId} = ${schema.users.id})`,
    ))

  let streakWarnings = 0
  for (const candidate of streakCandidates) {
    if (!isStreakRiskWindow(candidate.timezone, now)) continue
    const today = localDateKey(candidate.timezone, now)
    const [pending] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.occurrences)
      .where(and(
        eq(schema.occurrences.userId, candidate.userId),
        eq(schema.occurrences.dueDate, today),
        eq(schema.occurrences.status, 'pending'),
      ))
    const pendingCount = pending?.count ?? 0
    if (pendingCount === 0) continue

    const result = await notifySafely(candidate.userId, 'streak_at_risk', today, locale => ({
      ...pushMessages(locale).streakAtRisk(candidate.currentStreak, pendingCount),
      url: '/app',
      tag: 'streak-at-risk',
    }))
    if (result && result.sent > 0) streakWarnings++
  }

  return { configured: true, reminders, streakWarnings }
}
