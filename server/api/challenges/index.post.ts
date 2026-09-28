import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { createChallenge, toChallengeHttpError } from '../../utils/challenges'
import { createChallengeSchema, parseBody } from '../../utils/validation'

// Le créateur rejoint son défi (et paie sa mise) ; le jeton d'invitation n'est renvoyé qu'ici
export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const input = parseBody(createChallengeSchema, await readBody(event))
  try {
    const { challenge, token } = await createChallenge(user, input)
    return { id: challenge.id, token }
  } catch (error) {
    toChallengeHttpError(error)
  }
})
