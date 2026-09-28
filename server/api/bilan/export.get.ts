import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { buildWeeklyCsv, loadWeeklyData, resolveReviewWeek } from '../../utils/weekly-review'

// Export CSV de la semaine : échéances et mouvements de crédits
export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const week = resolveReviewWeek(getQuery(event).week, user.timezone)
  const data = await loadWeeklyData(user, week)

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="focus-bilan-${week.start}.csv"`)
  setHeader(event, 'Cache-Control', 'no-store')
  return buildWeeklyCsv(data, user.timezone)
})
