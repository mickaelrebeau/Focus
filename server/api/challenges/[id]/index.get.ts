import { getUserFromEvent, requireAuth } from '../../../utils/auth'
import { getChallengeDetail, toChallengeHttpError } from '../../../utils/challenges'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID requis' })
  try {
    return await getChallengeDetail(user, id)
  } catch (error) {
    toChallengeHttpError(error)
  }
})
