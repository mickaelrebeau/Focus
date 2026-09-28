// Les messages d'erreur de l'API d'authentification sont en français : on les traduit
// à partir du code HTTP, et on garde le message du serveur pour les cas non prévus.
const STATUS_KEYS: Record<number, string> = {
  401: 'auth.errors.invalidCredentials',
  403: 'auth.errors.accountSuspended',
  409: 'auth.errors.emailTaken',
  429: 'auth.errors.tooManyAttempts',
}

export function useAuthErrorMessage() {
  const { t } = useI18n()

  return (error: unknown, fallbackKey: string) => {
    const fetchError = error as { statusCode?: number, data?: { message?: string } } | null
    const key = fetchError?.statusCode ? STATUS_KEYS[fetchError.statusCode] : undefined
    if (key) return t(key)
    return fetchError?.data?.message ?? t(fallbackKey)
  }
}
