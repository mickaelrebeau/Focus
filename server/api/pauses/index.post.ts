import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { createPauseSchema, parseBody } from '../../utils/validation'
import { createPause, toPauseHttpError } from '../../utils/pauses'
import { getTodayInTimezone } from '../../utils/occurrences'
import { reevaluateUserDay } from '../../utils/streaks'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const data = parseBody(createPauseSchema, await readBody(event))

  try {
    const result = await createPause(user, data)
    // Si la pause commence aujourd'hui, la journée n'est plus « à faire »
    const today = getTodayInTimezone(user.timezone)
    if (data.startDate <= today && today <= data.endDate) {
      await reevaluateUserDay(user.id, today, user.timezone)
    }
    return result
  } catch (error) {
    toPauseHttpError(error)
  }
})
