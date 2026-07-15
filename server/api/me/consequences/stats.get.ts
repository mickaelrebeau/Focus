import { getUserFromEvent, requireAuth } from '../../../utils/auth'
import { buildConsequenceStatsRecord, getConsequenceStatsForUser } from '../../../utils/consequences-stats'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const stats = await getConsequenceStatsForUser(user.id)

  return {
    stats,
    record: buildConsequenceStatsRecord(stats),
  }
})
