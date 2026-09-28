// Caches remplis par le service worker (voir `pwa.workbox.runtimeCaching` dans nuxt.config.ts).
// Ils contiennent des données personnelles : on les vide quand l'utilisateur change.
export const OFFLINE_CACHE_NAMES = ['focus-pages', 'focus-api'] as const

export async function clearOfflineCaches() {
  if (!import.meta.client || !('caches' in window)) return

  try {
    await Promise.all(OFFLINE_CACHE_NAMES.map(name => caches.delete(name)))
  } catch (error) {
    console.warn('[offline] Impossible de vider les caches :', error)
  }
}
