import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { revokePartnership, toPartnershipHttpError } from '../../utils/partnerships'

// Révocation du binôme (par l'un ou l'autre) ou annulation d'une invitation en attente
export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID requis' })
  try {
    await revokePartnership(user.id, id)
    return { revoked: true }
  } catch (error) {
    toPartnershipHttpError(error)
  }
})
