import { getInvitation, toPartnershipHttpError } from '../../../../utils/partnerships'

// Public : la page d'invitation s'affiche avant connexion. Seul le prénom de l'invitant est exposé.
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) throw createError({ statusCode: 400, message: 'Jeton requis' })
  try {
    const invitation = await getInvitation(token)
    return { inviterName: invitation.inviterName, expiresAt: invitation.expiresAt }
  } catch (error) {
    toPartnershipHttpError(error)
  }
})
