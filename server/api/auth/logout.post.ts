import { deleteSession, clearSessionCookie, getUserFromEvent } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'focus_session')
  if (token) {
    await deleteSession(token)
  }
  clearSessionCookie(event)
  return { success: true }
})
