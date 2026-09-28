import { eq, sql } from 'drizzle-orm'
import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { useDatabase, schema } from '../../database'
import { getNotificationPreferences, getVapidPublicKey } from '../../utils/push'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const db = useDatabase()

  const [devices] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, user.id))

  const { userId: _userId, updatedAt: _updatedAt, ...preferences } = await getNotificationPreferences(user.id)

  return {
    // Clé publique lue au lancement : null si le serveur n'a pas de clés VAPID
    publicKey: getVapidPublicKey(),
    devices: devices?.count ?? 0,
    preferences,
  }
})
