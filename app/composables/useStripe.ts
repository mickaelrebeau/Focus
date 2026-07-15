const fetchOptions = { credentials: 'include' as const }

export interface StripePaymentMethodSummary {
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

export function useStripeSetup() {
  const createSetupIntent = () =>
    $fetch<{ clientSecret: string, customerId: string }>('/api/stripe/setup-intent', {
      method: 'POST',
      ...fetchOptions,
    })

  const confirmSetup = (paymentMethodId: string) =>
    $fetch<{ summary: StripePaymentMethodSummary }>(
      '/api/stripe/confirm-setup',
      {
        method: 'POST',
        body: { paymentMethodId },
        ...fetchOptions,
      },
    )

  const fetchPaymentMethod = () =>
    $fetch<{ configured: boolean, summary: StripePaymentMethodSummary | null }>(
      '/api/user/payment-method',
      fetchOptions,
    )

  return { createSetupIntent, confirmSetup, fetchPaymentMethod }
}
