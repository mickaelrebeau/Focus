<script setup lang="ts">
export interface OccurrenceItem {
  id: string
  status: string
  dueAt: string
  dueDate: string
  goal: {
    id: string
    title: string
    type: string
    category?: string
    rewardCredits: number
    penaltyCredits: number
  }
  milestone?: { id: string; title: string } | null
  validation?: { status: string } | null
}

const props = defineProps<{
  occurrence: OccurrenceItem
}>()

const emit = defineEmits<{
  complete: [id: string]
}>()

const statusVariant = computed(() => {
  switch (props.occurrence.status) {
    case 'completed': return 'success'
    case 'failed': return 'danger'
    case 'pending': return isOverdue.value ? 'warning' : 'neutral'
    default: return 'neutral'
  }
})

const isOverdue = computed(() => {
  if (props.occurrence.status !== 'pending') return false
  return new Date(props.occurrence.dueAt) < new Date()
})

const statusLabel = computed(() => {
  const labels: Record<string, string> = {
    pending: isOverdue.value ? 'En retard' : 'À faire',
    completed: 'Réussi',
    failed: 'Échoué',
    skipped: 'Ignoré',
  }
  return labels[props.occurrence.status] ?? props.occurrence.status
})
</script>

<template>
  <div class="focus-card flex items-start justify-between gap-4">
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <UiBadge :variant="statusVariant">{{ statusLabel }}</UiBadge>
        <span v-if="occurrence.goal.category" class="text-xs text-focus-gray-400">{{ occurrence.goal.category }}</span>
      </div>
      <h3 class="mt-2 font-medium text-focus-gray-900">{{ occurrence.goal.title }}</h3>
      <p v-if="occurrence.milestone" class="text-sm text-focus-gray-500">{{ occurrence.milestone.title }}</p>
      <p class="mt-1 text-xs text-focus-gray-400">
        Échéance : {{ new Date(occurrence.dueAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }}
      </p>
      <p class="mt-1 text-xs text-focus-gray-400">
        +{{ occurrence.goal.rewardCredits }} / -{{ occurrence.goal.penaltyCredits }} crédits
      </p>
    </div>
    <UiButton
      v-if="occurrence.status === 'pending'"
      variant="primary"
      class="shrink-0 text-xs"
      @click="emit('complete', occurrence.id)"
    >
      Valider
    </UiButton>
  </div>
</template>
