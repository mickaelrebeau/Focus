import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { listMyChallenges } from '../../utils/challenges'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  return { challenges: await listMyChallenges(user) }
})
