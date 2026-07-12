import { createSession, setSessionCookie } from '../../../utils/auth'
import {
  assertGoogleOAuthConfigured,
  exchangeGoogleCode,
  fetchGoogleProfile,
  findOrCreateGoogleUser,
  redirectWithOAuthError,
  verifyOAuthState,
} from '../../../utils/google-oauth'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = query.code as string | undefined
  const state = query.state as string | undefined
  const oauthError = query.error as string | undefined

  if (oauthError) {
    return redirectWithOAuthError(event, oauthError === 'access_denied' ? 'google_denied' : 'google_failed')
  }

  if (!code || !state) {
    return redirectWithOAuthError(event, 'google_failed')
  }

  try {
    assertGoogleOAuthConfigured()

    const stateValid = await verifyOAuthState(state)
    if (!stateValid) {
      return redirectWithOAuthError(event, 'google_failed')
    }

    const accessToken = await exchangeGoogleCode(code)
    const profile = await fetchGoogleProfile(accessToken)
    const result = await findOrCreateGoogleUser(profile)

    const session = await createSession(result.user.id)
    setSessionCookie(event, session.token)

    const config = useRuntimeConfig()
    const destination = result.isNew
      ? '/app/onboarding'
      : result.user.role === 'admin'
        ? '/admin'
        : result.user.onboardingCompleted
          ? '/app'
          : '/app/onboarding'

    return sendRedirect(event, `${config.public.appUrl}${destination}`)
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const statusCode = (error as { statusCode: number }).statusCode
      if (statusCode === 403) {
        return redirectWithOAuthError(event, 'google_blocked')
      }
      if (statusCode === 400) {
        return redirectWithOAuthError(event, 'google_email_unverified')
      }
    }
    return redirectWithOAuthError(event, 'google_failed')
  }
})
