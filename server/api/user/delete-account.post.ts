import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { clearSessionCookie, getUserFromEvent, requireAuth } from '../../utils/auth'
import { useDatabase, schema } from '../../database'
import { parseBody } from '../../utils/validation'
import { verifyPassword } from '../../utils/password'
import { rateLimitFromEnv, redisIncr } from '../../utils/redis'
import { softDeleteAccount } from '../../utils/account-deletion'

const deleteAccountSchema = z.object({
  confirmEmail: z.string().trim().min(1, 'Saisissez votre email pour confirmer'),
  password: z.string().optional(),
})

// Droit à l'effacement (RGPD) : irréversible, confirmé par l'email et le mot de passe
export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const data = parseBody(deleteAccountSchema, await readBody(event))

  if (user.role === 'admin') {
    throw createError({ statusCode: 403, message: 'Un compte administrateur ne peut pas être supprimé depuis l’application' })
  }

  const attempts = await redisIncr(`delete-account:${user.id}`, 900)
  if (attempts > rateLimitFromEnv('DELETE_ACCOUNT_RATE_LIMIT', 5)) {
    throw createError({ statusCode: 429, message: 'Trop de tentatives, réessayez plus tard' })
  }

  if (data.confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
    throw createError({ statusCode: 400, message: 'L’email saisi ne correspond pas à votre compte' })
  }

  const [dbUser] = await useDatabase()
    .select({ passwordHash: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1)

  // Compte Google sans mot de passe : l'email saisi suffit
  if (dbUser?.passwordHash && !(data.password && await verifyPassword(data.password, dbUser.passwordHash))) {
    throw createError({ statusCode: 400, message: 'Mot de passe incorrect' })
  }

  const result = await softDeleteAccount(user)
  clearSessionCookie(event)
  return { success: true, purgeAt: result?.purgeAt ?? null }
})
