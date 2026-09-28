import { and, eq } from 'drizzle-orm'
import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { useDatabase, schema } from '../../database'
import { parseBody, pushUnsubscribeSchema } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const { endpoint } = parseBody(pushUnsubscribeSchema, await readBody(event))

  await useDatabase()
    .delete(schema.pushSubscriptions)
    .where(and(
      eq(schema.pushSubscriptions.userId, user.id),
      eq(schema.pushSubscriptions.endpoint, endpoint),
    ))

  return { subscribed: false }
})
