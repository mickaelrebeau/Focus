import { LOCALE_COOKIE, isSupportedLocale } from '~/utils/locale'

// Applique la langue choisie par l'utilisateur (cookie), côté serveur comme côté client,
// pour que le rendu SSR et l'hydratation utilisent la même langue.
export default defineNuxtPlugin({
  name: 'focus-locale',
  dependsOn: ['i18n:plugin'],
  async setup(nuxtApp) {
    const saved = useCookie<string | null>(LOCALE_COOKIE).value
    if (isSupportedLocale(saved) && saved !== nuxtApp.$i18n.locale.value) {
      await nuxtApp.$i18n.setLocale(saved)
    }
  },
})
