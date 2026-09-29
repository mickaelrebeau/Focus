import { getUserFromEvent, requireAuth } from '../utils/auth'
import { getSlotStatsForUser } from '../utils/time-slots'

// Taux de réussite par créneau horaire, pour suggérer une heure limite à la création
export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const category = getQuery(event).category
  return getSlotStatsForUser(user, typeof category === 'string' ? category.slice(0, 50) : undefined)
})
