import { createHmac } from 'node:crypto'
import { getUserFromEvent, requireAuth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  if (!config.userjotSecretKey) {
    throw createError({ statusCode: 404, message: 'Userjot non configuré' })
  }

  const user = requireAuth(await getUserFromEvent(event))

  const signature = createHmac('sha256', config.userjotSecretKey)
    .update(user.id)
    .digest('hex')

  return { signature }
})
