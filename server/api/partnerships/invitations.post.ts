import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { createInvitation, toPartnershipHttpError } from '../../utils/partnerships'

// Le jeton n'est renvoyé qu'ici (seule son empreinte est stockée) : le client compose le lien
export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  try {
    return await createInvitation(user.id)
  } catch (error) {
    toPartnershipHttpError(error)
  }
})
