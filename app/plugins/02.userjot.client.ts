import type { AuthUser } from '~/composables/useAuth'

function loadUserjotSdk() {
  if (document.querySelector('script[data-userjot]')) return

  window.$ujq = window.$ujq || []
  window.uj = window.uj || new Proxy({}, {
    get: (_, prop: string) => (...args: unknown[]) => window.$ujq.push([prop, ...args]),
  }) as UserjotSDK

  const script = document.createElement('script')
  script.setAttribute('data-userjot', 'loader')
  script.src = 'https://cdn.userjot.com/sdk/v2/uj.js'
  script.type = 'module'
  script.async = true
  document.head.appendChild(script)
}

function toUserjotIdentity(user: AuthUser, signature?: string) {
  const [firstName, ...rest] = user.displayName.trim().split(/\s+/)

  return {
    id: user.id,
    email: user.email,
    firstName: firstName || user.displayName,
    ...(rest.length ? { lastName: rest.join(' ') } : {}),
    ...(signature ? { signature } : {}),
  }
}

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const projectId = config.public.userjotProjectId

  if (!projectId) return

  loadUserjotSdk()

  window.uj.init(projectId, {
    widget: true,
    theme: 'auto',
    position: 'right',
  })
  window.uj.disableWidget()

  const { user } = useAuth()
  const route = useRoute()

  async function syncUserjot() {
    const isAppArea = route.path.startsWith('/app')
    const currentUser = user.value

    if (!currentUser || !isAppArea) {
      window.uj.identify(null)
      window.uj.disableWidget()
      return
    }

    let signature: string | undefined
    if (config.userjotSecretKey) {
      try {
        const data = await $fetch<{ signature: string }>('/api/userjot/signature', {
          credentials: 'include',
        })
        signature = data.signature
      } catch {
        // Identification sans signature si l'endpoint échoue
      }
    }

    window.uj.identify(toUserjotIdentity(currentUser, signature))
    window.uj.enableWidget()
  }

  watch([user, () => route.path], syncUserjot, { immediate: true })
})
