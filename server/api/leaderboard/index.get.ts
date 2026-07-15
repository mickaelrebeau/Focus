import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { getLeaderboard, getWeeklyProgressForUser, getLeaderboardWeekKey } from '../../utils/leaderboard'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const leaderboard = await getLeaderboard(user.id)
  const weeklyProgress = await getWeeklyProgressForUser(user.id)

  return {
    leaderboard,
    weeklyProgress,
    weekKey: getLeaderboardWeekKey(),
  }
})
