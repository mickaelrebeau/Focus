import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'

const fetchOptions = { credentials: 'include' as const }

export function useGoals() {
  const queryClient = useQueryClient()
  const requestFetch = useRequestFetch()

  const goalsQuery = useQuery({
    queryKey: ['goals'],
    queryFn: () => requestFetch<{ goals: any[] }>('/api/goals', fetchOptions),
  })

  const createGoal = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      requestFetch('/api/goals', { method: 'POST', body: data, ...fetchOptions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      queryClient.invalidateQueries({ queryKey: ['occurrences'] })
    },
  })

  return { goalsQuery, createGoal }
}

export function useOccurrences(filter?: Ref<string | undefined>) {
  const queryKey = computed(() => ['occurrences', filter?.value ?? 'all'])
  const requestFetch = useRequestFetch()

  const occurrencesQuery = useQuery({
    queryKey,
    queryFn: () => requestFetch('/api/occurrences', {
      query: filter?.value ? { filter: filter.value } : undefined,
      ...fetchOptions,
    }),
  })

  const queryClient = useQueryClient()

  const completeOccurrence = useMutation({
    mutationFn: ({ id, ...body }: { id: string; note?: string; proofType?: string; proofContent?: string; proofUrl?: string }) =>
      requestFetch(`/api/occurrences/${id}/complete`, { method: 'POST', body, ...fetchOptions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['occurrences'] })
      queryClient.invalidateQueries({ queryKey: ['auth'] })
    },
  })

  return { occurrencesQuery, completeOccurrence }
}

export function useLeaderboard() {
  const requestFetch = useRequestFetch()

  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => requestFetch<{ leaderboard: any[] }>('/api/leaderboard', fetchOptions),
  })
}

export function useWalletHistory() {
  const requestFetch = useRequestFetch()

  return useQuery({
    queryKey: ['wallet-history'],
    queryFn: () => requestFetch<{ entries: any[] }>('/api/wallet/history', fetchOptions),
  })
}
