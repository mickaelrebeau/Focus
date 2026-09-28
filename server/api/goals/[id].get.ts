import { eq } from 'drizzle-orm'
import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { useDatabase, schema } from '../../database'
import { requireOwnedGoal, syncUserDeadlines } from '../../utils/goals-service'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const goal = await requireOwnedGoal(event, user.id)
  const db = useDatabase()

  await syncUserDeadlines(user.id, user.timezone)
  const milestones = goal.type === 'project'
    ? await db.select().from(schema.projectMilestones).where(eq(schema.projectMilestones.goalId, goal.id))
    : []

  const occurrences = await db
    .select()
    .from(schema.occurrences)
    .where(eq(schema.occurrences.goalId, goal.id))
    .orderBy(schema.occurrences.dueAt)

  return { goal: { ...goal, milestones }, occurrences }
})
