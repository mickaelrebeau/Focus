import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getUserFromEvent, requireAuth } from '../../../../utils/auth'
import { useDatabase, schema } from '../../../../database'
import { generateUpcomingOccurrences, requireOwnedGoal } from '../../../../utils/goals-service'
import { parseBody } from '../../../../utils/validation'
import { logAudit } from '../../../../utils/audit'

// « Débloquer quand même » : retire la dépendance d'un jalon (ex. après l'échec du précédent)
const schemaBody = z.object({ dependsOnMilestoneId: z.null() })

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const goal = await requireOwnedGoal(event, user.id)
  parseBody(schemaBody, await readBody(event))
  const milestoneId = getRouterParam(event, 'milestoneId') ?? ''

  const [updated] = await useDatabase()
    .update(schema.projectMilestones)
    .set({ dependsOnMilestoneId: null })
    .where(and(eq(schema.projectMilestones.id, milestoneId), eq(schema.projectMilestones.goalId, goal.id)))
    .returning()
  if (!updated) throw createError({ statusCode: 404, message: 'Jalon introuvable' })

  await logAudit(user.id, 'milestone.unlock', 'project_milestone', milestoneId, { goalId: goal.id })
  await generateUpcomingOccurrences(undefined, { userId: user.id })
  return { milestone: updated }
})
