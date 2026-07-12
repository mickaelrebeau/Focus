import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { getStreakForUser, syncTodayStreak } from '../../utils/streaks'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  await syncTodayStreak(user.id, user.timezone ?? 'Europe/Paris')
  const streak = await getStreakForUser(user.id)
  return { streak }
})
