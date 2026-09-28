import { getUserFromEvent, requireAuth } from '../../../utils/auth'
import { leaveChallenge, toChallengeHttpError } from '../../../utils/challenges'

// Avant le début de la semaine, la mise est remboursée ; ensuite, elle reste dans la cagnotte
export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID requis' })
  try {
    return await leaveChallenge(user, id)
  } catch (error) {
    toChallengeHttpError(error)
  }
})
