export interface AuthUser {
  id: string
  email: string
  displayName: string
  role: 'user' | 'admin'
  timezone?: string
  credits: number
  debt: number
  netScore: number
  onboardingCompleted: boolean
  leaderboardOptIn?: boolean
  hasPassword?: boolean
  hasPaymentMethod?: boolean
  paymentMethodBrand?: string
  paymentMethodLast4?: string
  paymentMethodExpMonth?: number
  paymentMethodExpYear?: number
  activePause?: { id: string, startDate: string, endDate: string } | null
}

import { clearOfflineCaches } from '~/utils/offline-cache'

const fetchOptions = { credentials: 'include' as const }

export function useAuth() {
  const user = useState<AuthUser | null>('auth-user', () => null)
  const requestFetch = useRequestFetch()

  async function fetchUser() {
    try {
      const data = await requestFetch<{ user: AuthUser }>('/api/auth/me', fetchOptions)
      user.value = data.user
      return data.user
    } catch (error) {
      // Sans réponse du serveur (hors ligne, serveur injoignable), on garde l'utilisateur
      // connu : seul un refus explicite du serveur (401…) déconnecte.
      if (!(error as { response?: unknown }).response) {
        return user.value
      }
      user.value = null
      return null
    }
  }

  async function login(email: string, password: string) {
    await clearOfflineCaches()
    const data = await $fetch<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      ...fetchOptions,
    })
    user.value = data.user
    return data.user
  }

  async function register(email: string, password: string, displayName: string) {
    await clearOfflineCaches()
    const data = await $fetch<{ user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: { email, password, displayName },
      ...fetchOptions,
    })
    user.value = data.user
    return data.user
  }

  async function logout() {
    // Avant la fin de session : la suppression côté serveur exige d'être authentifié
    await unsubscribeThisDevice()
    await requestFetch('/api/auth/logout', { method: 'POST', ...fetchOptions })
    await clearOfflineCaches()
    user.value = null
    await navigateTo('/connexion')
  }

  async function loginWithGoogle() {
    await clearOfflineCaches()
    window.location.href = '/api/auth/google'
  }

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  return {
    user,
    isAuthenticated,
    isAdmin,
    fetchUser,
    login,
    register,
    logout,
    loginWithGoogle,
  }
}
