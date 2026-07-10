import { eq, desc, and, lte } from 'drizzle-orm'
import { getUserFromEvent, requireAuth, requireAdmin } from '../../utils/auth'
import { useDatabase, schema } from '../../database'

export default defineEventHandler(async (event) => {
  requireAdmin(requireAuth(await getUserFromEvent(event)))
  const db = useDatabase()

  const occurrences = await db
    .select({
      occurrence: schema.occurrences,
      goal: schema.goals,
      user: schema.users,
    })
    .from(schema.occurrences)
    .innerJoin(schema.goals, eq(schema.occurrences.goalId, schema.goals.id))
    .innerJoin(schema.users, eq(schema.occurrences.userId, schema.users.id))
    .where(and(
      eq(schema.occurrences.status, 'pending'),
      lte(schema.occurrences.dueAt, new Date()),
    ))
    .orderBy(desc(schema.occurrences.dueAt))
    .limit(50)

  return {
    occurrences: occurrences.map(({ occurrence, goal, user }) => ({
      ...occurrence,
      goal: { id: goal.id, title: goal.title },
      user: { id: user.id, displayName: user.displayName, email: user.email },
    })),
  }
})
