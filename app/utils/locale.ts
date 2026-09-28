import { enUS, fr } from 'date-fns/locale'

export const LOCALE_COOKIE = 'focus_locale'
export const SUPPORTED_LOCALES = ['fr', 'en'] as const
export type SupportedLocale = typeof SUPPORTED_LOCALES[number]

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

const DATE_FNS_LOCALES = { fr, en: enUS } as const

export function dateFnsLocale(locale: string) {
  return isSupportedLocale(locale) ? DATE_FNS_LOCALES[locale] : fr
}
