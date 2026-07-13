<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })

const { data, isLoading } = useWalletHistory()

const typeLabels: Record<string, string> = {
  task_reward: 'Récompense',
  task_penalty: 'Pénalité',
  debt_created: 'Dette créée',
  debt_repayment: 'Remboursement dette',
  admin_adjustment: 'Ajustement admin',
  signup_bonus: 'Bonus inscription',
  streak_bonus: 'Bonus streak',
  leaderboard_reward: 'Bonus classement',
  transfer_received: 'Transfert reçu',
}
</script>

<template>
  <div class="p-5 md:p-8">
    <h1 class="focus-heading-lg">Historique</h1>

    <div v-if="isLoading" class="mt-8 space-y-3">
      <div v-for="i in 5" :key="i" class="focus-card h-14 animate-pulse bg-focus-gray-50" />
    </div>

    <div v-else class="mt-8 space-y-3">
      <div v-for="entry in data?.entries ?? []" :key="entry.id" class="focus-card flex items-center justify-between">
        <div class="flex flex-col gap-2">
          <p class="font-medium text-focus-gray-900">{{ typeLabels[entry.type] ?? entry.type }}</p>
          <p class="text-xs text-focus-gray-400">
            {{ new Date(entry.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
          </p>
          <p v-if="entry.reason" class="text-xs text-focus-gray-400">{{ entry.reason }}</p>
        </div>
        <span class="font-semibold" :class="entry.amount >= 0 ? 'text-emerald-600' : 'text-red-500'">
          {{ entry.amount >= 0 ? '+' : '' }}{{ entry.amount }}
        </span>
      </div>
    </div>
  </div>
</template>
