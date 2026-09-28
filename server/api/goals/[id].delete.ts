import { eq } from 'drizzle-orm'
import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { useDatabase, schema } from '../../database'
import { requireOwnedGoal } from '../../utils/goals-service'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const goal = await requireOwnedGoal(event, user.id)
  const db = useDatabase()

  await db.update(schema.goals).set({ isActive: false, updatedAt: new Date() }).where(eq(schema.goals.id, goal.id))
  return { success: true }
})
