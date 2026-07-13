import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { getLeaderboard, getWeeklyProgressForUser, getLeaderboardWeekKey } from '../../utils/leaderboard'
import { getCommunityPotStats } from '../../utils/community-pot'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const leaderboard = await getLeaderboard(user.id)
  const weeklyProgress = await getWeeklyProgressForUser(user.id)
  const communityPot = await getCommunityPotStats()

  return {
    leaderboard,
    weeklyProgress,
    weekKey: getLeaderboardWeekKey(),
    communityPot,
  }
})
