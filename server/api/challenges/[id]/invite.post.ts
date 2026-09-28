import { getUserFromEvent, requireAuth } from '../../../utils/auth'
import { regenerateInvite, toChallengeHttpError } from '../../../utils/challenges'

// Nouveau lien d'invitation (l'ancien cesse de fonctionner) : seule l'empreinte est stockée
export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID requis' })
  try {
    return await regenerateInvite(user.id, id)
  } catch (error) {
    toChallengeHttpError(error)
  }
})
