import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { useDatabase, schema } from '../../database'
import { notificationPreferencesSchema, parseBody } from '../../utils/validation'
import { getNotificationPreferences } from '../../utils/push'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const data = parseBody(notificationPreferencesSchema, await readBody(event))
  const db = useDatabase()

  await db
    .insert(schema.notificationPreferences)
    .values({ userId: user.id, ...data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.notificationPreferences.userId,
      set: { ...data, updatedAt: new Date() },
    })

  const { userId: _userId, updatedAt: _updatedAt, ...preferences } = await getNotificationPreferences(user.id)
  return { preferences }
})
