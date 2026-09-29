import { eq } from 'drizzle-orm'
import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { useDatabase, schema } from '../../database'
import { generateUpcomingOccurrences, requireOwnedGoal } from '../../utils/goals-service'
import { parseBody, updateGoalSchema } from '../../utils/validation'
import { assertValidGoalDependency } from '../../utils/dependency-service'
import { logAudit } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const goal = await requireOwnedGoal(event, user.id)
  const db = useDatabase()

  const data = parseBody(updateGoalSchema, await readBody(event))
  if (data.dependsOnGoalId) await assertValidGoalDependency(user.id, goal.id, data.dependsOnGoalId)

  const [updated] = await db
    .update(schema.goals)
    .set({
      title: data.title ?? goal.title,
      description: data.description !== undefined ? data.description : goal.description,
      isActive: data.isActive ?? goal.isActive,
      dependsOnGoalId: data.dependsOnGoalId !== undefined ? data.dependsOnGoalId : goal.dependsOnGoalId,
      dependencyMode: data.dependencyMode ?? goal.dependencyMode,
      updatedAt: new Date(),
    })
    .where(eq(schema.goals.id, goal.id))
    .returning()

  const dependencyChanged = updated!.dependsOnGoalId !== goal.dependsOnGoalId || updated!.dependencyMode !== goal.dependencyMode
  if (dependencyChanged) {
    // Déblocage manuel ou changement de prérequis : tracé, puis échéances à générer si débloqué
    await logAudit(user.id, 'goal.dependency_update', 'goal', goal.id, {
      from: goal.dependsOnGoalId,
      to: updated!.dependsOnGoalId,
      mode: updated!.dependencyMode,
    })
    await generateUpcomingOccurrences(undefined, { userId: user.id })
  }
  return { goal: updated }
})
