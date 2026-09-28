import { LOCALE_COOKIE, dateFnsLocale, type SupportedLocale } from '~/utils/locale'

export function useLanguage() {
  const { locale, locales, setLocale } = useI18n()
  const cookie = useCookie<string | null>(LOCALE_COOKIE, {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
  })

  const available = computed(() => locales.value.map(item => ({ code: item.code, name: item.name ?? item.code })))
  const dateLocale = computed(() => dateFnsLocale(locale.value))

  async function changeLanguage(code: SupportedLocale) {
    cookie.value = code
    await setLocale(code)
  }

  return { locale, available, dateLocale, changeLanguage }
}
