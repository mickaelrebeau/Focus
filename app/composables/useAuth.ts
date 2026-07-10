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
}

const fetchOptions = { credentials: 'include' as const }

export function useAuth() {
  const user = useState<AuthUser | null>('auth-user', () => null)
  const requestFetch = useRequestFetch()

  async function fetchUser() {
    try {
      const data = await requestFetch<{ user: AuthUser }>('/api/auth/me', fetchOptions)
      user.value = data.user
      return data.user
    } catch {
      user.value = null
      return null
    }
  }

  async function login(email: string, password: string) {
    const data = await $fetch<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      ...fetchOptions,
    })
    user.value = data.user
    return data.user
  }

  async function register(email: string, password: string, displayName: string) {
    const data = await $fetch<{ user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: { email, password, displayName },
      ...fetchOptions,
    })
    user.value = data.user
    return data.user
  }

  async function logout() {
    await requestFetch('/api/auth/logout', { method: 'POST', ...fetchOptions })
    user.value = null
    await navigateTo('/connexion')
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
  }
}
