import { getUserFromEvent } from '../../utils/auth'
import { getActivePause } from '../../utils/pauses'

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Non authentifié' })
  }
  const pause = await getActivePause(user.id, user.timezone)
  return {
    user: {
      ...user,
      activePause: pause ? { id: pause.id, startDate: pause.startDate, endDate: pause.endDate } : null,
    },
  }
})
