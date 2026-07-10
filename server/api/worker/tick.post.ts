import { processExpiredOccurrences, generateUpcomingOccurrences } from '../../utils/goals-service'

export default defineEventHandler(async () => {
  const expired = await processExpiredOccurrences()
  const generated = await generateUpcomingOccurrences()
  return { expired, generated }
})
