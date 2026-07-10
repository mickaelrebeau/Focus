import { eq, desc } from 'drizzle-orm'
import { getUserFromEvent, requireAuth, requireAdmin } from '../../../utils/auth'
import { useDatabase, schema } from '../../../database'

export default defineEventHandler(async (event) => {
  requireAdmin(requireAuth(await getUserFromEvent(event)))
  const db = useDatabase()

  const validations = await db
    .select({
      validation: schema.validations,
      occurrence: schema.occurrences,
      goal: schema.goals,
      user: schema.users,
    })
    .from(schema.validations)
    .innerJoin(schema.occurrences, eq(schema.validations.occurrenceId, schema.occurrences.id))
    .innerJoin(schema.goals, eq(schema.occurrences.goalId, schema.goals.id))
    .innerJoin(schema.users, eq(schema.validations.userId, schema.users.id))
    .where(eq(schema.validations.status, 'pending_review'))
    .orderBy(desc(schema.validations.createdAt))

  return {
    validations: validations.map(({ validation, occurrence, goal, user }) => ({
      ...validation,
      occurrence,
      goal: { id: goal.id, title: goal.title },
      user: { id: user.id, displayName: user.displayName, email: user.email },
    })),
  }
})
