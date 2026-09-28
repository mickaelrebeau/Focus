import { desc, eq } from 'drizzle-orm'
import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { useDatabase, schema } from '../../database'
import { getTodayInTimezone } from '../../utils/occurrences'
import { MAX_PAUSE_DAYS, pauseStatus } from '../../utils/pauses'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const today = getTodayInTimezone(user.timezone)

  const pauses = await useDatabase()
    .select()
    .from(schema.pausePeriods)
    .where(eq(schema.pausePeriods.userId, user.id))
    .orderBy(desc(schema.pausePeriods.startDate), desc(schema.pausePeriods.createdAt))

  return {
    today,
    maxDays: MAX_PAUSE_DAYS,
    pauses: pauses.map(pause => ({
      id: pause.id,
      startDate: pause.startDate,
      endDate: pause.endDate,
      originalEndDate: pause.originalEndDate,
      reason: pause.reason,
      createdAt: pause.createdAt,
      status: pauseStatus(pause, today),
    })),
  }
})
