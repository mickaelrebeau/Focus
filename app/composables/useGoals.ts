import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'

const fetchOptions = { credentials: 'include' as const }

function createApiFetch() {
  const requestFetch = useRequestFetch()
  return <T>(url: string, options?: Parameters<typeof $fetch>[1]) =>
    import.meta.server
      ? requestFetch<T>(url, options)
      : $fetch<T>(url, options)
}

export function useGoals() {
  const queryClient = useQueryClient()
  const apiFetch = createApiFetch()
  const { user } = useAuth()

  const queryFn = () => apiFetch<{ goals: any[] }>('/api/goals', fetchOptions)

  onServerPrefetch(async () => {
    if (user.value) {
      await queryClient.prefetchQuery({ queryKey: ['goals'], queryFn })
    }
  })

  const goalsQuery = useQuery({
    queryKey: ['goals'],
    queryFn,
    staleTime: 60_000,
  })

  const createGoal = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch('/api/goals', { method: 'POST', body: data, ...fetchOptions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      queryClient.invalidateQueries({ queryKey: ['occurrences'] })
    },
  })

  return { ...goalsQuery, createGoal }
}

export function useOccurrences(filter?: Ref<string | undefined>) {
  const queryClient = useQueryClient()
  const apiFetch = createApiFetch()
  const { user } = useAuth()

  const queryKey = computed(() => ['occurrences', filter?.value ?? 'all'])

  const queryFn = () => apiFetch<{ occurrences: any[] }>('/api/occurrences', {
    query: filter?.value ? { filter: filter.value } : undefined,
    ...fetchOptions,
  })

  onServerPrefetch(async () => {
    if (user.value) {
      await queryClient.prefetchQuery({ queryKey: queryKey.value, queryFn })
    }
  })

  const occurrencesQuery = useQuery({
    queryKey,
    queryFn,
    staleTime: 60_000,
  })

  const completeOccurrence = useMutation({
    mutationFn: ({ id, ...body }: { id: string; note?: string; proofType?: string; proofContent?: string; proofUrl?: string }) =>
      apiFetch(`/api/occurrences/${id}/complete`, { method: 'POST', body, ...fetchOptions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['occurrences'] })
      queryClient.invalidateQueries({ queryKey: ['auth'] })
    },
  })

  return { ...occurrencesQuery, completeOccurrence }
}

export function useLeaderboard() {
  const queryClient = useQueryClient()
  const apiFetch = createApiFetch()
  const { user } = useAuth()

  const queryFn = () => apiFetch<{ leaderboard: any[] }>('/api/leaderboard', fetchOptions)

  onServerPrefetch(async () => {
    if (user.value) {
      await queryClient.prefetchQuery({ queryKey: ['leaderboard'], queryFn })
    }
  })

  return useQuery({
    queryKey: ['leaderboard'],
    queryFn,
    staleTime: 60_000,
  })
}

export function useWalletHistory() {
  const queryClient = useQueryClient()
  const apiFetch = createApiFetch()
  const { user } = useAuth()

  const queryFn = () => apiFetch<{ entries: any[] }>('/api/wallet/history', fetchOptions)

  onServerPrefetch(async () => {
    if (user.value) {
      await queryClient.prefetchQuery({ queryKey: ['wallet-history'], queryFn })
    }
  })

  return useQuery({
    queryKey: ['wallet-history'],
    queryFn,
    staleTime: 60_000,
  })
}
