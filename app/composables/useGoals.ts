import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'

export function useGoals() {
  const queryClient = useQueryClient()

  const goalsQuery = useQuery({
    queryKey: ['goals'],
    queryFn: () => $fetch<{ goals: any[] }>('/api/goals'),
  })

  const createGoal = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      $fetch('/api/goals', { method: 'POST', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      queryClient.invalidateQueries({ queryKey: ['occurrences'] })
    },
  })

  return { goalsQuery, createGoal }
}

export function useOccurrences(filter?: Ref<string | undefined>) {
  const queryKey = computed(() => ['occurrences', filter?.value ?? 'all'])

  const occurrencesQuery = useQuery({
    queryKey,
    queryFn: () => $fetch('/api/occurrences', {
      query: filter?.value ? { filter: filter.value } : undefined,
    }),
  })

  const queryClient = useQueryClient()

  const completeOccurrence = useMutation({
    mutationFn: ({ id, ...body }: { id: string; note?: string; proofType?: string; proofContent?: string; proofUrl?: string }) =>
      $fetch(`/api/occurrences/${id}/complete`, { method: 'POST', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['occurrences'] })
      queryClient.invalidateQueries({ queryKey: ['auth'] })
    },
  })

  return { occurrencesQuery, completeOccurrence }
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => $fetch<{ leaderboard: any[] }>('/api/leaderboard'),
  })
}

export function useWalletHistory() {
  return useQuery({
    queryKey: ['wallet-history'],
    queryFn: () => $fetch<{ entries: any[] }>('/api/wallet/history'),
  })
}
