import {
  assertGoogleOAuthConfigured,
  buildGoogleAuthUrl,
  createOAuthState,
} from '../../utils/google-oauth'

export default defineEventHandler(async (event) => {
  assertGoogleOAuthConfigured()

  const state = await createOAuthState()
  return sendRedirect(event, buildGoogleAuthUrl(state))
})
