import { eq, and } from 'drizzle-orm'
import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { useDatabase, schema } from '../../database'
import { syncUserDeadlines } from '../../utils/goals-service'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID requis' })

  const db = useDatabase()

  const [goal] = await db
    .select()
    .from(schema.goals)
    .where(and(eq(schema.goals.id, id), eq(schema.goals.userId, user.id)))
    .limit(1)

  if (!goal) throw createError({ statusCode: 404, message: 'Objectif introuvable' })

  if (event.method === 'GET') {
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
  }

  if (event.method === 'PATCH') {
    const body = await readBody(event)
    const [updated] = await db
      .update(schema.goals)
      .set({
        title: body.title ?? goal.title,
        description: body.description ?? goal.description,
        isActive: body.isActive ?? goal.isActive,
        updatedAt: new Date(),
      })
      .where(eq(schema.goals.id, id))
      .returning()
    return { goal: updated }
  }

  if (event.method === 'DELETE') {
    await db.update(schema.goals).set({ isActive: false, updatedAt: new Date() }).where(eq(schema.goals.id, id))
    return { success: true }
  }
})
