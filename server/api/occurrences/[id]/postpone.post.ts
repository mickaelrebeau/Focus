import { getUserFromEvent, requireAuth } from '../../../utils/auth'
import { postponeOccurrence, toPostponeHttpError } from '../../../utils/postpone'

// Report d'un jour : 1 par semaine, avant expiration, tracé dans le journal d'audit
export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID requis' })

  try {
    return await postponeOccurrence(user, id)
  } catch (error) {
    toPostponeHttpError(error)
  }
})
