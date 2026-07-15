export default defineNuxtRouteMiddleware(() => {
  const { isAuthenticated } = useAuth()
  setPageLayout(isAuthenticated.value ? 'app' : 'default')
})
