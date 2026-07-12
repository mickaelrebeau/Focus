import { eq, or } from 'drizzle-orm'
import { useDatabase, schema } from '../database'
import { generateToken } from './password'
import { redisGet, redisDel, redisSet } from './redis'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'
const OAUTH_STATE_TTL = 600

export interface GoogleProfile {
  sub: string
  email: string
  name: string
  email_verified?: boolean
}

export function assertGoogleOAuthConfigured() {
  const config = useRuntimeConfig()
  if (!config.googleClientId || !config.googleClientSecret) {
    throw createError({ statusCode: 503, message: 'Connexion Google non configurée' })
  }
}

export function getGoogleRedirectUri() {
  const config = useRuntimeConfig()
  return `${config.public.appUrl}/api/auth/google/callback`
}

export function buildGoogleAuthUrl(state: string) {
  const config = useRuntimeConfig()
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: getGoogleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
    access_type: 'online',
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export async function createOAuthState(): Promise<string> {
  const state = generateToken()
  await redisSet(`oauth:google:${state}`, '1', OAUTH_STATE_TTL)
  return state
}

export async function verifyOAuthState(state: string): Promise<boolean> {
  const key = `oauth:google:${state}`
  const value = await redisGet(key)
  if (!value) return false
  await redisDel(key)
  return true
}

export async function exchangeGoogleCode(code: string): Promise<string> {
  const config = useRuntimeConfig()
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: getGoogleRedirectUri(),
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    throw createError({ statusCode: 502, message: 'Échec de l\'authentification Google' })
  }

  const data = await response.json() as { access_token?: string }
  if (!data.access_token) {
    throw createError({ statusCode: 502, message: 'Token Google invalide' })
  }

  return data.access_token
}

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw createError({ statusCode: 502, message: 'Impossible de récupérer le profil Google' })
  }

  return response.json() as Promise<GoogleProfile>
}

export async function findOrCreateGoogleUser(profile: GoogleProfile) {
  if (!profile.email_verified) {
    throw createError({ statusCode: 400, message: 'Email Google non vérifié' })
  }

  const db = useDatabase()
  const config = useRuntimeConfig()
  const email = profile.email.toLowerCase()
  const googleId = profile.sub

  const [existing] = await db
    .select({
      user: schema.users,
      wallet: schema.wallets,
    })
    .from(schema.users)
    .leftJoin(schema.wallets, eq(schema.users.id, schema.wallets.userId))
    .where(or(
      eq(schema.users.googleId, googleId),
      eq(schema.users.email, email),
    ))
    .limit(1)

  if (existing) {
    if (existing.user.isBlocked) {
      throw createError({ statusCode: 403, message: 'Compte suspendu' })
    }

    if (existing.user.googleId && existing.user.googleId !== googleId) {
      throw createError({ statusCode: 409, message: 'Cet email est déjà associé à un autre compte Google' })
    }

    if (!existing.user.googleId) {
      await db
        .update(schema.users)
        .set({ googleId, updatedAt: new Date() })
        .where(eq(schema.users.id, existing.user.id))
    }

    return {
      user: existing.user,
      wallet: existing.wallet,
      isNew: false,
    }
  }

  const [user] = await db.insert(schema.users).values({
    email,
    googleId,
    displayName: profile.name || email.split('@')[0]!,
    role: email === config.adminEmail.toLowerCase() ? 'admin' : 'user',
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

  return {
    user,
    wallet: { balance: 50, debt: 0 },
    isNew: true,
  }
}

export function redirectWithOAuthError(event: H3Event, code: string) {
  const config = useRuntimeConfig()
  return sendRedirect(event, `${config.public.appUrl}/connexion?error=${code}`)
}
