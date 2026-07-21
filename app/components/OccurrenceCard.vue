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

const statusClass = computed(() => {
  switch (props.occurrence.status) {
    case 'completed': return 'text-emerald-600'
    case 'failed': return 'text-red-500'
    case 'pending': return isOverdue.value ? 'text-amber-600' : 'text-app-secondary'
    default: return 'text-app-secondary'
  }
})

const isDone = computed(() =>
  props.occurrence.status === 'completed' || props.occurrence.status === 'failed',
)

const dueLabel = computed(() =>
  new Date(props.occurrence.dueAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }),
)
</script>

<template>
  <div class="app-row flex items-center gap-4">
    <button
      v-if="occurrence.status === 'pending'"
      type="button"
      class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-app-line text-app-ink transition hover:border-app-ink hover:bg-app-mist focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 active:scale-95"
      :aria-label="`Valider ${occurrence.goal.title}`"
      @click="emit('complete', occurrence.id)"
    >
      <AppIcon name="check" class="h-5 w-5" />
    </button>
    <div
      v-else
      class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
      :class="occurrence.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'"
    >
      <AppIcon :name="occurrence.status === 'completed' ? 'check' : 'close'" class="h-5 w-5" />
    </div>

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium" :class="statusClass">{{ statusLabel }}</span>
        <span v-if="occurrence.goal.category" class="text-xs text-slate-400">· {{ occurrence.goal.category }}</span>
      </div>
      <h3
        class="mt-0.5 truncate text-base font-semibold tracking-tight text-app-ink"
        :class="{ '!text-slate-400 line-through decoration-slate-300': isDone && occurrence.status === 'completed' }"
      >
        {{ occurrence.goal.title }}
      </h3>
      <p v-if="occurrence.milestone" class="truncate text-sm text-app-secondary">
        {{ occurrence.milestone.title }}
      </p>
      <p class="mt-1 text-xs text-app-secondary">
        {{ dueLabel }}
        <span class="text-slate-300"> · </span>
        +{{ occurrence.goal.rewardCredits }} / −{{ occurrence.goal.penaltyCredits }}
      </p>
    </div>
  </div>
</template>
