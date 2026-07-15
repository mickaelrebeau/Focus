import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'

const fetchOptions = { credentials: 'include' as const }

function createApiFetch() {
  const requestFetch = useRequestFetch()
  return <T>(url: string, options?: Parameters<typeof $fetch>[1]) =>
    import.meta.server
      ? requestFetch<T>(url, options)
      : $fetch<T>(url, options)
}

export interface ConsequenceType {
  id: string
  key: string
  name: string
  description: string
  icon: string
  enabled: boolean
}

export interface UserConsequence {
  id: string
  userId: string
  type: string
  enabled: boolean
  amount: number
  priority: number
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ConsequenceEstimate {
  label: string
  description: string
}

export interface ConsequenceStats {
  totalConfigured: number
  totalExecuted: number
  moneyCommittedCents: number
  moneyDonatedCents: number
  creditsLost: number
}

export function isMonetaryConsequenceType(type: string): boolean {
  return type === 'donation'
    || type === 'stripe'
}

export function isCreditsConsequenceType(type: string): boolean {
  return type === 'credits'
    || type === 'random-user'
}

export function isBehaviorConsequenceType(type: string): boolean {
  return type === 'mandatory-proof'
}

export function formatEuroFromCents(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

export function eurosToCents(euros: number): number {
  return Math.round(euros * 100)
}

export function centsToEuros(cents: number): number {
  return cents / 100
}

export function useConsequenceTypes() {
  const apiFetch = createApiFetch()
  const { user } = useAuth()

  const queryFn = () => apiFetch<{ types: ConsequenceType[] }>('/api/consequences', fetchOptions)

  onServerPrefetch(async () => {
    if (user.value) {
      await useQueryClient().prefetchQuery({ queryKey: ['consequence-types'], queryFn })
    }
  })

  return useQuery({
    queryKey: ['consequence-types'],
    queryFn,
    staleTime: 60_000,
  })
}

export function useUserConsequences() {
  const queryClient = useQueryClient()
  const apiFetch = createApiFetch()
  const { user } = useAuth()

  const queryFn = () => apiFetch<{ consequences: UserConsequence[] }>('/api/me/consequences', fetchOptions)

  onServerPrefetch(async () => {
    if (user.value) {
      await queryClient.prefetchQuery({ queryKey: ['me-consequences'], queryFn })
    }
  })

  const consequencesQuery = useQuery({
    queryKey: ['me-consequences'],
    queryFn,
    staleTime: 60_000,
  })

  const createConsequence = useMutation({
    mutationFn: (body: {
      type: string
      enabled?: boolean
      amount: number
      priority?: number
      config?: Record<string, unknown>
    }) => apiFetch<{ consequence: UserConsequence }>('/api/me/consequences', {
      method: 'POST',
      body,
      ...fetchOptions,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me-consequences'] })
      queryClient.invalidateQueries({ queryKey: ['consequence-stats'] })
    },
  })

  const updateConsequence = useMutation({
    mutationFn: ({ id, ...body }: {
      id: string
      enabled?: boolean
      amount?: number
      priority?: number
      config?: Record<string, unknown>
    }) => apiFetch<{ consequence: UserConsequence }>(`/api/me/consequences/${id}`, {
      method: 'PATCH',
      body,
      ...fetchOptions,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me-consequences'] })
      queryClient.invalidateQueries({ queryKey: ['consequence-stats'] })
      queryClient.invalidateQueries({ queryKey: ['auth'] })
      queryClient.invalidateQueries({ queryKey: ['wallet-history'] })
    },
  })

  const deleteConsequence = useMutation({
    mutationFn: (id: string) => apiFetch<{ success: boolean }>(`/api/me/consequences/${id}`, {
      method: 'DELETE',
      ...fetchOptions,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me-consequences'] })
      queryClient.invalidateQueries({ queryKey: ['consequence-stats'] })
    },
  })

  const reorderConsequences = useMutation({
    mutationFn: (orderedIds: string[]) => apiFetch<{ consequences: UserConsequence[] }>('/api/me/consequences/reorder', {
      method: 'POST',
      body: { orderedIds },
      ...fetchOptions,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me-consequences'] })
    },
  })

  const estimateConsequence = useMutation({
    mutationFn: (body: {
      type: string
      amount: number
      config?: Record<string, unknown>
    }) => apiFetch<{ estimate: ConsequenceEstimate }>('/api/consequences/estimate', {
      method: 'POST',
      body,
      ...fetchOptions,
    }),
  })

  return {
    ...consequencesQuery,
    createConsequence,
    updateConsequence,
    deleteConsequence,
    reorderConsequences,
    estimateConsequence,
  }
}

export function useConsequenceStats() {
  const apiFetch = createApiFetch()
  const { user } = useAuth()

  const queryFn = () => apiFetch<{ stats: ConsequenceStats }>('/api/me/consequences/stats', fetchOptions)

  onServerPrefetch(async () => {
    if (user.value) {
      await useQueryClient().prefetchQuery({ queryKey: ['consequence-stats'], queryFn })
    }
  })

  return useQuery({
    queryKey: ['consequence-stats'],
    queryFn,
    staleTime: 60_000,
  })
}
