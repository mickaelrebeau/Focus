import { eq } from 'drizzle-orm'
import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { useDatabase, schema } from '../../database'
import { requireOwnedGoal } from '../../utils/goals-service'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const goal = await requireOwnedGoal(event, user.id)
  const db = useDatabase()

  const body = await readBody(event)
  const [updated] = await db
    .update(schema.goals)
    .set({
      title: body.title ?? goal.title,
      description: body.description ?? goal.description,
      isActive: body.isActive ?? goal.isActive,
      updatedAt: new Date(),
    })
    .where(eq(schema.goals.id, goal.id))
    .returning()
  return { goal: updated }
})
