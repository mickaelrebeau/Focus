import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { pushMessages, sendPushToUser } from '../../utils/push'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  return sendPushToUser(user.id, 'test', `test-${Date.now()}`, locale => ({
    ...pushMessages(locale).test(),
    url: '/app/reglages/notifications',
    tag: 'focus-test',
  }))
})
