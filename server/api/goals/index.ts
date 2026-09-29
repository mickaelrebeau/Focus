import { eq, desc, and } from 'drizzle-orm'
import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { useDatabase, schema } from '../../database'
import { createGoalSchema, parseBody } from '../../utils/validation'
import { generateUpcomingOccurrences } from '../../utils/goals-service'
import { assertValidGoalDependency, goalLockState } from '../../utils/dependency-service'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const db = useDatabase()

  if (event.method === 'GET') {
    const goals = await db
      .select()
      .from(schema.goals)
      .where(and(eq(schema.goals.userId, user.id), eq(schema.goals.isActive, true)))
      .orderBy(desc(schema.goals.createdAt))

    const goalsWithMilestones = await Promise.all(
      goals.map(async (goal) => {
        // Liste : l'état de verrouillage suffit (le détail est dans GET /api/goals/:id)
        const lockState = await goalLockState(goal.dependsOnGoalId)
        if (goal.type !== 'project') return { ...goal, lockState, milestones: [] }
        const milestones = await db
          .select()
          .from(schema.projectMilestones)
          .where(eq(schema.projectMilestones.goalId, goal.id))
          .orderBy(schema.projectMilestones.orderIndex)
        return { ...goal, lockState, milestones }
      }),
    )

    return { goals: goalsWithMilestones }
  }

  if (event.method === 'POST') {
    const body = await readBody(event)
    const data = parseBody(createGoalSchema, body)
    if (data.dependsOnGoalId) await assertValidGoalDependency(user.id, null, data.dependsOnGoalId)

    const goal = (await db.insert(schema.goals).values({
      userId: user.id,
      title: data.title,
      description: data.description,
      category: data.category,
      type: data.type,
      dependsOnGoalId: data.dependsOnGoalId,
      dependencyMode: data.dependencyMode,
      dueDate: data.type === 'one_time' ? data.dueDate : undefined,
      recurrenceType: data.type === 'recurring' ? data.recurrenceType : undefined,
      recurrenceConfig: data.type === 'recurring'
        ? { ...data.recurrenceConfig, dueTime: data.recurrenceConfig.dueTime ?? '23:59' }
        : data.type === 'one_time'
          ? { dueTime: data.dueTime ?? '23:59' }
          : undefined,
    }).returning())[0]!

    if (data.type === 'project') {
      let previousId: string | undefined
      for (const [index, milestone] of data.milestones.entries()) {
        const [inserted] = await db.insert(schema.projectMilestones).values({
          goalId: goal.id,
          title: milestone.title,
          description: milestone.description,
          dueDate: milestone.dueDate,
          orderIndex: index,
          // Chaîne : chaque jalon attend la réussite du précédent
          dependsOnMilestoneId: data.sequentialMilestones ? previousId : undefined,
        }).returning({ id: schema.projectMilestones.id })
        previousId = inserted!.id
      }
    }

    await generateUpcomingOccurrences(undefined, { userId: user.id })

    const milestones = data.type === 'project'
      ? await db.select().from(schema.projectMilestones).where(eq(schema.projectMilestones.goalId, goal.id))
      : []

    return { goal: { ...goal, milestones } }
  }
})
