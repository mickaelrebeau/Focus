import { getUserFromEvent, requireAuth, requireAdmin } from '../../../utils/auth'
import { adminAdjustSchema, parseBody } from '../../../utils/validation'
import { adminAdjustCredits } from '../../../utils/credits'
import { logAudit } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(requireAuth(await getUserFromEvent(event)))
  const userId = getRouterParam(event, 'id')
  if (!userId) throw createError({ statusCode: 400, message: 'ID requis' })

  const body = await readBody(event)
  const data = parseBody(adminAdjustSchema, body)

  const result = await adminAdjustCredits(userId, data.amount, admin.id, data.reason)
  await logAudit(admin.id, 'credits.adjust', 'user', userId, data, getRequestIP(event) ?? undefined)

  return result
})
