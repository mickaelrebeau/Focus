import { eq } from 'drizzle-orm'
import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { useDatabase, schema } from '../../database'
import { requireOwnedGoal, syncUserDeadlines } from '../../utils/goals-service'
import { goalLockState, milestoneLocks } from '../../utils/dependency-service'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const goal = await requireOwnedGoal(event, user.id)
  const db = useDatabase()

  await syncUserDeadlines(user.id, user.timezone)
  // Jalons avec leur verrou : `locked` (attend le précédent) ou `blocked` (le précédent a échoué)
  const milestones = goal.type === 'project'
    ? await milestoneLocks(goal.id).then(({ milestones, locks }) => milestones.map(milestone => ({ ...milestone, lockState: locks.get(milestone.id)! })))
    : []

  const prerequisite = goal.dependsOnGoalId
    ? (await db.select({ id: schema.goals.id, title: schema.goals.title }).from(schema.goals).where(eq(schema.goals.id, goal.dependsOnGoalId)).limit(1))[0]
    : undefined
  const dependency = prerequisite
    ? { goal: prerequisite, mode: goal.dependencyMode, lockState: await goalLockState(goal.dependsOnGoalId) }
    : null

  const occurrences = await db
    .select()
    .from(schema.occurrences)
    .where(eq(schema.occurrences.goalId, goal.id))
    .orderBy(schema.occurrences.dueAt)

  return { goal: { ...goal, milestones, dependency }, occurrences }
})
