import { eq, and, gt } from 'drizzle-orm'
import { useDatabase, schema } from '../database'
import { generateToken } from './password'

const SESSION_DURATION_DAYS = 30

export async function createSession(userId: string) {
  const db = useDatabase()
  const token = generateToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS)

  const [session] = await db.insert(schema.sessions).values({
    userId,
    token,
    expiresAt,
  }).returning()

  return session
}

export async function getSessionByToken(token: string) {
  const db = useDatabase()
  const now = new Date()

  const [session] = await db
    .select({
      session: schema.sessions,
      user: schema.users,
      wallet: schema.wallets,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .leftJoin(schema.wallets, eq(schema.users.id, schema.wallets.userId))
    .where(and(
      eq(schema.sessions.token, token),
      gt(schema.sessions.expiresAt, now),
    ))
    .limit(1)

  return session ?? null
}

export async function deleteSession(token: string) {
  const db = useDatabase()
  await db.delete(schema.sessions).where(eq(schema.sessions.token, token))
}

export async function getUserFromEvent(event: H3Event) {
  const token = getCookie(event, 'focus_session')
  if (!token) return null

  const session = await getSessionByToken(token)
  if (!session || session.user.isBlocked) return null

  return {
    id: session.user.id,
    email: session.user.email,
    displayName: session.user.displayName,
    role: session.user.role,
    timezone: session.user.timezone,
    onboardingCompleted: session.user.onboardingCompleted,
    leaderboardOptIn: session.user.leaderboardOptIn,
    hasPassword: !!session.user.passwordHash,
    credits: session.wallet?.balance ?? 0,
    debt: session.wallet?.debt ?? 0,
    netScore: (session.wallet?.balance ?? 0) - (session.wallet?.debt ?? 0),
  }
}

export function requireAuth(user: Awaited<ReturnType<typeof getUserFromEvent>>) {
  if (!user) {
    throw createError({ statusCode: 401, message: 'Non authentifié' })
  }
  return user
}

export function requireAdmin(user: NonNullable<Awaited<ReturnType<typeof getUserFromEvent>>>) {
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Accès administrateur requis' })
  }
  return user
}

export function setSessionCookie(event: H3Event, token: string) {
  setCookie(event, 'focus_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
  })
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, 'focus_session', {
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  })
}
