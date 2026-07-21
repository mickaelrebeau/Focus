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
  <div class="app-page animate-fade-in">
    <p class="app-eyebrow">Portefeuille</p>
    <h1 class="app-heading mt-1">Historique</h1>
    <p class="mt-1 text-sm text-app-secondary">Mouvements de votre portefeuille</p>

    <div v-if="isLoading" class="mt-8 space-y-3">
      <div v-for="i in 5" :key="i" class="app-row h-16 animate-pulse" />
    </div>

    <div v-else-if="!(data?.entries ?? []).length" class="app-sheet mt-8 px-6 py-16 text-center">
      <p class="text-sm text-app-secondary">Aucun mouvement pour le moment.</p>
    </div>

    <div v-else class="app-list-stagger mt-8 space-y-3">
      <div
        v-for="entry in data?.entries ?? []"
        :key="entry.id"
        class="app-row flex items-center justify-between gap-3"
      >
        <div class="min-w-0">
          <p class="font-semibold text-app-ink">{{ typeLabels[entry.type] ?? entry.type }}</p>
          <p class="mt-0.5 text-xs text-app-secondary">
            {{ new Date(entry.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
          </p>
          <p v-if="entry.reason" class="mt-1 text-xs text-app-secondary">{{ entry.reason }}</p>
        </div>
        <span
          class="shrink-0 text-base font-semibold tabular-nums"
          :class="entry.amount >= 0 ? 'text-emerald-600' : 'text-red-500'"
        >
          {{ entry.amount >= 0 ? '+' : '' }}{{ entry.amount }}
        </span>
      </div>
    </div>
  </div>
</template>
