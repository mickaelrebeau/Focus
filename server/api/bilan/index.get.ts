import { addDays, format, parseISO } from 'date-fns'
import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { getTodayInTimezone } from '../../utils/occurrences'
import { computeWeeklyReview, loadWeeklyData, resolveReviewWeek, weekRange } from '../../utils/weekly-review'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const week = resolveReviewWeek(getQuery(event).week, user.timezone)
  const data = await loadWeeklyData(user, week)
  const current = weekRange(getTodayInTimezone(user.timezone))

  return {
    review: computeWeeklyReview({ week, ...data }),
    previousWeek: format(addDays(parseISO(week.start), -7), 'yyyy-MM-dd'),
    nextWeek: week.start < current.start ? format(addDays(parseISO(week.start), 7), 'yyyy-MM-dd') : null,
    isCurrentWeek: week.start === current.start,
  }
})
