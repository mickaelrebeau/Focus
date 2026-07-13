import { useDatabase, schema } from '../database'

export async function createNotification(input: {
  userId: string
  title: string
  message: string
  metadata?: Record<string, unknown>
}) {
  const db = useDatabase()

  const [notification] = await db.insert(schema.notifications).values({
    userId: input.userId,
    title: input.title,
    message: input.message,
    metadata: input.metadata,
  }).returning()

  return notification
}
