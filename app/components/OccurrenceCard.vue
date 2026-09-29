<script setup lang="ts">
export interface OccurrenceItem {
  id: string
  status: string
  dueAt: string
  dueDate: string
  originalDueAt?: string | null
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

const props = withDefaults(defineProps<{
  occurrence: OccurrenceItem
  /** Reports encore disponibles cette semaine (0 : bouton masqué) */
  postponeRemaining?: number
}>(), { postponeRemaining: 0 })

const emit = defineEmits<{
  complete: [id: string]
}>()

const { t, te, localeProperties } = useI18n()
const { user } = useAuth()

const isOverdue = computed(() => {
  if (props.occurrence.status !== 'pending') return false
  return new Date(props.occurrence.dueAt) < new Date()
})

const statusLabel = computed(() => {
  const status = props.occurrence.status === 'pending' && isOverdue.value ? 'overdue' : props.occurrence.status
  const key = `occurrence.status.${status}`
  return te(key) ? t(key) : props.occurrence.status
})

const statusClass = computed(() => {
  switch (props.occurrence.status) {
    case 'completed': return 'text-emerald-600'
    case 'failed': return 'text-red-500'
    case 'pending': return isOverdue.value ? 'text-amber-600' : 'text-app-secondary'
    default: return 'text-app-secondary'
  }
})

// Pendant le délai de grâce : « En retard », mais l'échec réel n'intervient qu'à cette heure
const graceDeadline = computed(() => {
  const grace = user.value?.graceMinutes ?? 0
  if (!isOverdue.value || grace <= 0) return null
  const failAt = new Date(new Date(props.occurrence.dueAt).getTime() + grace * 60_000)
  if (failAt.getTime() <= Date.now()) return null
  return failAt.toLocaleTimeString(localeProperties.value.language ?? 'fr-FR', { hour: '2-digit', minute: '2-digit' })
})

// Report possible tant que l'échéance n'a pas expiré (heure limite + grâce) : aucune conséquence n'est partie
const canPostpone = computed(() => {
  if (props.occurrence.status !== 'pending' || props.occurrence.originalDueAt || props.postponeRemaining <= 0) return false
  const failAt = new Date(props.occurrence.dueAt).getTime() + (user.value?.graceMinutes ?? 0) * 60_000
  return failAt > Date.now()
})

const postpone = usePostponeOccurrence()
const confirmingPostpone = ref(false)
const postponeError = ref('')

async function confirmPostpone() {
  postponeError.value = ''
  try {
    await postpone.mutateAsync(props.occurrence.id)
    confirmingPostpone.value = false
  } catch (error: any) {
    postponeError.value = error?.data?.message ?? t('occurrence.postponeError')
  }
}

const isDone = computed(() =>
  props.occurrence.status === 'completed' || props.occurrence.status === 'failed',
)

const dueLabel = computed(() =>
  new Date(props.occurrence.dueAt).toLocaleDateString(localeProperties.value.language ?? 'fr-FR', {
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
      :aria-label="t('occurrence.validate', { title: occurrence.goal.title })"
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
        <span v-if="graceDeadline" class="text-xs text-amber-700">· {{ t('grace.failsAt', { time: graceDeadline }) }}</span>
        <span v-if="occurrence.originalDueAt" class="text-xs text-app-secondary">· {{ t('occurrence.postponed') }}</span>
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
      <div v-if="canPostpone" class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <template v-if="!confirmingPostpone">
          <button type="button" class="font-semibold text-app-secondary underline-offset-2 hover:text-app-ink hover:underline" @click="confirmingPostpone = true">
            {{ t('occurrence.postpone') }}
          </button>
        </template>
        <template v-else>
          <span class="text-app-secondary">{{ t('occurrence.postponeHint') }}</span>
          <button type="button" class="font-semibold text-app-ink underline underline-offset-2" :disabled="postpone.isPending.value" @click="confirmPostpone">
            {{ t('occurrence.postponeConfirm') }}
          </button>
          <button type="button" class="text-app-secondary hover:text-app-ink" @click="confirmingPostpone = false">
            {{ t('common.cancel') }}
          </button>
        </template>
      </div>
      <p v-if="postponeError" class="mt-1 text-xs text-red-500">{{ postponeError }}</p>
    </div>
  </div>
</template>
