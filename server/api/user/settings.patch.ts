import { eq } from 'drizzle-orm'
import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { useDatabase, schema } from '../../database'
import { updateSettingsSchema, parseBody } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const body = await readBody(event)
  const data = parseBody(updateSettingsSchema, body)
  const db = useDatabase()

  const [updated] = await db
    .update(schema.users)
    .set({
      displayName: data.displayName ?? user.displayName,
      timezone: data.timezone ?? user.timezone,
      leaderboardOptIn: data.leaderboardOptIn ?? user.leaderboardOptIn,
      onboardingCompleted: true,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, user.id))
    .returning()

  return {
    user: {
      id: updated.id,
      displayName: updated.displayName,
      timezone: updated.timezone,
      leaderboardOptIn: updated.leaderboardOptIn,
      onboardingCompleted: updated.onboardingCompleted,
    },
  }
})
