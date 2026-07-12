import { loginSchema, parseBody } from '../../utils/validation'
import { verifyPassword } from '../../utils/password'
import { createSession, setSessionCookie } from '../../utils/auth'
import { useDatabase, schema } from '../../database'
import { eq } from 'drizzle-orm'
import { redisIncr } from '../../utils/redis'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const data = parseBody(loginSchema, body)

  const ip = getRequestIP(event) ?? 'unknown'
  const attempts = await redisIncr(`login:${ip}`, 900)
  if (attempts > 20) {
    throw createError({ statusCode: 429, message: 'Trop de tentatives de connexion' })
  }

  const db = useDatabase()

  const [user] = await db
    .select({
      user: schema.users,
      wallet: schema.wallets,
    })
    .from(schema.users)
    .leftJoin(schema.wallets, eq(schema.users.id, schema.wallets.userId))
    .where(eq(schema.users.email, data.email.toLowerCase()))
    .limit(1)

  if (!user || !user.user.passwordHash || !(await verifyPassword(data.password, user.user.passwordHash))) {
    throw createError({ statusCode: 401, message: 'Email ou mot de passe incorrect' })
  }

  if (user.user.isBlocked) {
    throw createError({ statusCode: 403, message: 'Compte suspendu' })
  }

  const session = await createSession(user.user.id)
  setSessionCookie(event, session.token)

  return {
    user: {
      id: user.user.id,
      email: user.user.email,
      displayName: user.user.displayName,
      role: user.user.role,
      timezone: user.user.timezone,
      credits: user.wallet?.balance ?? 0,
      debt: user.wallet?.debt ?? 0,
      netScore: (user.wallet?.balance ?? 0) - (user.wallet?.debt ?? 0),
      onboardingCompleted: user.user.onboardingCompleted,
      leaderboardOptIn: user.user.leaderboardOptIn,
      hasPassword: !!user.user.passwordHash,
    },
  }
})
