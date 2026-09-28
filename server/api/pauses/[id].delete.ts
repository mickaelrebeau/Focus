import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { endPause, toPauseHttpError } from '../../utils/pauses'
import { getTodayInTimezone } from '../../utils/occurrences'
import { reevaluateUserDay } from '../../utils/streaks'

// Annule une pause à venir, ou termine une pause en cours (fin fixée à la veille)
export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID requis' })

  try {
    const result = await endPause(user, id)
    if (result.restored > 0) {
      await reevaluateUserDay(user.id, getTodayInTimezone(user.timezone), user.timezone)
    }
    return result
  } catch (error) {
    toPauseHttpError(error)
  }
})
