export interface NotificationPreferences {
  dueReminder: boolean
  dueReminderMinutes: 15 | 30 | 60 | 120 | 240
  streakAtRisk: boolean
  consequenceExecuted: boolean
  milestoneBonus: boolean
  locale: 'fr' | 'en'
}

interface PushStatus {
  publicKey: string | null
  devices: number
  preferences: NotificationPreferences
}

export type PushSupport = 'supported' | 'unsupported' | 'ios-not-installed'

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, char => char.charCodeAt(0))
}

function detectSupport(): PushSupport {
  if (!import.meta.client) return 'unsupported'
  const hasApis = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  // Sur iOS, le push n'est disponible que pour une PWA installée sur l'écran d'accueil
  if (isIos && !standalone) return 'ios-not-installed'
  return hasApis ? 'supported' : 'unsupported'
}

async function getRegistration() {
  return navigator.serviceWorker.ready
}

/**
 * Abonnement de cet appareil aux notifications push. Rien n'est demandé au navigateur
 * tant que l'utilisateur n'a pas cliqué sur « Activer » (consentement explicite).
 */
export function usePushNotifications() {
  const { locale } = useI18n()
  const support = ref<PushSupport>('unsupported')
  const permission = ref<NotificationPermission>('default')
  const subscribed = ref(false)
  const status = ref<PushStatus | null>(null)
  const busy = ref(false)

  const serverConfigured = computed(() => Boolean(status.value?.publicKey))

  async function refresh() {
    support.value = detectSupport()
    status.value = await $fetch<PushStatus>('/api/push/status', { credentials: 'include' })
    if (support.value !== 'supported') return
    permission.value = Notification.permission
    const registration = await getRegistration()
    subscribed.value = Boolean(await registration.pushManager.getSubscription())
  }

  async function enable() {
    if (!status.value?.publicKey) return
    busy.value = true
    try {
      permission.value = await Notification.requestPermission()
      if (permission.value !== 'granted') return

      const registration = await getRegistration()
      const subscription = await registration.pushManager.getSubscription()
        ?? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(status.value.publicKey),
        })

      await $fetch('/api/push/subscriptions', {
        method: 'POST',
        body: { subscription: subscription.toJSON(), locale: locale.value === 'en' ? 'en' : 'fr' },
        credentials: 'include',
      })
      subscribed.value = true
      await refresh()
    } finally {
      busy.value = false
    }
  }

  async function disable() {
    busy.value = true
    try {
      await unsubscribeThisDevice()
      subscribed.value = false
      await refresh()
    } finally {
      busy.value = false
    }
  }

  async function updatePreferences(patch: Partial<NotificationPreferences>) {
    const result = await $fetch<{ preferences: NotificationPreferences }>('/api/push/preferences', {
      method: 'PUT',
      body: patch,
      credentials: 'include',
    })
    if (status.value) status.value.preferences = result.preferences
  }

  async function sendTest() {
    return $fetch<{ sent: number, skipped?: string }>('/api/push/test', { method: 'POST', credentials: 'include' })
  }

  return { support, permission, subscribed, status, busy, serverConfigured, refresh, enable, disable, updatePreferences, sendTest }
}

/**
 * Désabonne cet appareil (côté navigateur et côté serveur). Appelé à la déconnexion :
 * un appareil partagé ne doit pas continuer à recevoir les notifications d'un autre compte.
 */
export async function unsubscribeThisDevice() {
  if (!import.meta.client || !('serviceWorker' in navigator) || !('PushManager' in window)) return
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) return
    await $fetch('/api/push/subscriptions', {
      method: 'DELETE',
      body: { endpoint: subscription.endpoint },
      credentials: 'include',
    }).catch(() => {})
    await subscription.unsubscribe()
  } catch (error) {
    console.warn('[push] Désabonnement impossible :', error)
  }
}
