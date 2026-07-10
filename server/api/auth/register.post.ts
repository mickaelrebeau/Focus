import { registerSchema, parseBody } from '../../utils/validation'
import { hashPassword } from '../../utils/password'
import { createSession, setSessionCookie } from '../../utils/auth'
import { useDatabase, schema } from '../../database'
import { eq } from 'drizzle-orm'
import { redisIncr } from '../../utils/redis'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const data = parseBody(registerSchema, body)

  const ip = getRequestIP(event) ?? 'unknown'
  const attempts = await redisIncr(`register:${ip}`, 3600)
  if (attempts > 10) {
    throw createError({ statusCode: 429, message: 'Trop de tentatives' })
  }

  const db = useDatabase()

  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, data.email.toLowerCase()))
    .limit(1)

  if (existing) {
    throw createError({ statusCode: 409, message: 'Cet email est déjà utilisé' })
  }

  const passwordHash = await hashPassword(data.password)
  const config = useRuntimeConfig()

  const [user] = await db.insert(schema.users).values({
    email: data.email.toLowerCase(),
    passwordHash,
    displayName: data.displayName,
    timezone: data.timezone ?? 'Europe/Paris',
    role: data.email.toLowerCase() === config.adminEmail.toLowerCase() ? 'admin' : 'user',
  }).returning()

  await db.insert(schema.wallets).values({
    userId: user.id,
    balance: 50,
    debt: 0,
  })

  await db.insert(schema.creditLedger).values({
    userId: user.id,
    type: 'signup_bonus',
    amount: 50,
    balanceAfter: 50,
    debtAfter: 0,
    reason: 'Bonus de bienvenue',
  })

  const session = await createSession(user.id)
  setSessionCookie(event, session.token)

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      credits: 50,
      debt: 0,
      netScore: 50,
      onboardingCompleted: false,
    },
  }
})
