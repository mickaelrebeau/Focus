import { getInvitation, toChallengeHttpError } from '../../../../utils/challenges'

// Public : la page d'invitation s'affiche avant connexion (nom du défi, prénom du créateur)
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) throw createError({ statusCode: 400, message: 'Jeton requis' })
  try {
    return await getInvitation(token)
  } catch (error) {
    toChallengeHttpError(error)
  }
})
