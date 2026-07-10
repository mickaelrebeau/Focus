export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchUser } = useAuth()

  if (!user.value) {
    await fetchUser()
  }

  if (!user.value) {
    return navigateTo('/connexion')
  }

  if (to.path.startsWith('/app') && !user.value.onboardingCompleted && to.path !== '/app/onboarding') {
    return navigateTo('/app/onboarding')
  }
})
