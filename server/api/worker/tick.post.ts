import { processExpiredOccurrences, generateUpcomingOccurrences } from '../../utils/goals-service'
import { processStreaksAfterExpiration } from '../../utils/streaks'
import { runLeaderboardJobs } from '../../utils/leaderboard'

export default defineEventHandler(async () => {
  const expired = await processExpiredOccurrences()
  const generated = await generateUpcomingOccurrences()
  const streaks = await processStreaksAfterExpiration()
  const leaderboard = await runLeaderboardJobs()
  return { expired, generated, streaks, leaderboard }
})
