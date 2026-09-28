import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { useDatabase, schema } from '../../database'
import { parseBody, pushSubscriptionSchema } from '../../utils/validation'
import { getVapidPublicKey } from '../../utils/push'

// Enregistre l'abonnement de cet appareil : c'est le consentement explicite de l'utilisateur,
// donné après l'autorisation du navigateur. Sans abonnement, aucune notification n'est envoyée.
export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  if (!getVapidPublicKey()) {
    throw createError({ statusCode: 503, message: 'Notifications push non configurées sur ce serveur' })
  }

  const { subscription, locale } = parseBody(pushSubscriptionSchema, await readBody(event))
  const db = useDatabase()
  const userAgent = getHeader(event, 'user-agent')?.slice(0, 300) ?? null

  // Un même appareil peut changer de compte : l'endpoint est rattaché au compte courant
  await db
    .insert(schema.pushSubscriptions)
    .values({
      userId: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
    })
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.endpoint,
      set: {
        userId: user.id,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
      },
    })

  await db
    .insert(schema.notificationPreferences)
    .values({ userId: user.id, locale: locale ?? 'fr' })
    .onConflictDoUpdate({
      target: schema.notificationPreferences.userId,
      set: locale ? { locale, updatedAt: new Date() } : { updatedAt: new Date() },
    })

  return { subscribed: true }
})
