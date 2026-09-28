import { getUserFromEvent, requireAuth } from '../../../../utils/auth'
import { joinChallenge, toChallengeHttpError } from '../../../../utils/challenges'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const token = getRouterParam(event, 'token')
  if (!token) throw createError({ statusCode: 400, message: 'Jeton requis' })
  try {
    const challenge = await joinChallenge(user, token)
    return { id: challenge.id }
  } catch (error) {
    toChallengeHttpError(error)
  }
})
