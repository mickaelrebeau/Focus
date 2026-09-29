import { eq, and, lte, or, isNotNull } from 'drizzle-orm'
import { format, parseISO, subDays } from 'date-fns'
import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { useDatabase, schema } from '../../database'
import { getTodayInTimezone } from '../../utils/occurrences'
import { syncUserDeadlines } from '../../utils/goals-service'
import { getPostponeQuota } from '../../utils/postpone'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  await syncUserDeadlines(user.id, user.timezone)
  const query = getQuery(event)
  const db = useDatabase()

  const filter = query.filter as string | undefined
  const today = getTodayInTimezone(user.timezone)

  let conditions = [eq(schema.occurrences.userId, user.id)]

  if (filter === 'today') {
    // Une échéance d'hier reportée d'un jour se fait aujourd'hui
    const yesterday = format(subDays(parseISO(today), 1), 'yyyy-MM-dd')
    conditions.push(or(
      eq(schema.occurrences.dueDate, today),
      and(eq(schema.occurrences.dueDate, yesterday), isNotNull(schema.occurrences.originalDueAt)),
    )!)
  } else if (filter === 'pending') {
    conditions.push(eq(schema.occurrences.status, 'pending'))
  } else if (filter === 'overdue') {
    conditions.push(eq(schema.occurrences.status, 'pending'))
    conditions.push(lte(schema.occurrences.dueAt, new Date()))
  }

  const occurrences = await db
    .select({
      occurrence: schema.occurrences,
      goal: schema.goals,
      validation: schema.validations,
      milestone: schema.projectMilestones,
    })
    .from(schema.occurrences)
    .innerJoin(schema.goals, eq(schema.occurrences.goalId, schema.goals.id))
    .leftJoin(schema.validations, eq(schema.occurrences.id, schema.validations.occurrenceId))
    .leftJoin(schema.projectMilestones, eq(schema.occurrences.milestoneId, schema.projectMilestones.id))
    .where(and(...conditions))
    .orderBy(schema.occurrences.dueAt)

  return {
    postpone: await getPostponeQuota(user),
    occurrences: occurrences.map(({ occurrence, goal, validation, milestone }) => ({
      ...occurrence,
      goal: {
        id: goal.id,
        title: goal.title,
        type: goal.type,
        category: goal.category,
        rewardCredits: goal.rewardCredits,
        penaltyCredits: goal.penaltyCredits,
      },
      milestone: milestone ? { id: milestone.id, title: milestone.title } : null,
      validation: validation ?? null,
    })),
  }
})
