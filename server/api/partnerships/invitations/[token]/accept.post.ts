import { getUserFromEvent, requireAuth } from '../../../../utils/auth'
import { acceptInvitation, toPartnershipHttpError } from '../../../../utils/partnerships'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const token = getRouterParam(event, 'token')
  if (!token) throw createError({ statusCode: 400, message: 'Jeton requis' })
  try {
    const partnership = await acceptInvitation(user.id, token)
    return { partnershipId: partnership.id }
  } catch (error) {
    toPartnershipHttpError(error)
  }
})
