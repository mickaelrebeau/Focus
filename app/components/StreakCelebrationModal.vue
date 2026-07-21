<script setup lang="ts">
export interface StreakCelebrationData {
  dailyPerfect: boolean
  currentStreak: number
  longestStreak: number
  nextMilestone: number
  progressToNext: number
  bonusAwarded: number | null
  milestoneReached: number | null
}

const props = defineProps<{
  modelValue: boolean
  data: StreakCelebrationData | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { burst } = useCelebration()
const modalRef = ref<HTMLElement | null>(null)

watch(() => props.modelValue, (open) => {
  if (open && props.data?.dailyPerfect) {
    nextTick(() => burst(modalRef.value))
  }
})

function close() {
  emit('update:modelValue', false)
}

const progressPercent = computed(() => {
  if (!props.data) return 0
  if (props.data.nextMilestone <= 0) return 0
  return Math.round((props.data.progressToNext / 7) * 100)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue && data"
      class="app-overlay fixed inset-0 z-50 flex items-end justify-center bg-slate-950/25 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      @click.self="close"
      @keydown.esc="close"
    >
      <div
        ref="modalRef"
        class="w-full max-w-md animate-slide-up rounded-t-[28px] bg-white p-6 pb-safe shadow-app-soft sm:rounded-app-card sm:pb-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="streak-title"
      >
        <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-app-line sm:hidden" />
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-app-mist text-app-blue">
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" />
          </svg>
        </div>
        <p class="app-eyebrow mt-4">Journée parfaite</p>
        <h2 id="streak-title" class="mt-2 text-3xl font-semibold tracking-tight text-app-ink">
          <span class="text-app-blue">{{ data.currentStreak }}</span>
          jour{{ data.currentStreak > 1 ? 's' : '' }} d'affilée
        </h2>
        <p class="mt-2 text-sm text-app-secondary">
          Toutes vos missions du jour sont validées. Continuez sur cette lancée !
        </p>

        <div class="mt-6 rounded-app-control bg-app-canvas px-4 py-4">
          <div class="flex items-center justify-between text-sm">
            <span class="text-app-secondary">Record personnel</span>
            <span class="font-semibold text-app-ink">{{ data.longestStreak }} jour{{ data.longestStreak > 1 ? 's' : '' }}</span>
          </div>
          <div class="mt-4">
            <div class="mb-1.5 flex justify-between text-xs text-app-secondary">
              <span>Prochain palier</span>
              <span>{{ data.progressToNext }}/7 → {{ data.nextMilestone }} jours</span>
            </div>
            <div class="app-progress">
              <div
                class="app-progress-bar"
                :style="{ width: `${progressPercent}%` }"
              />
            </div>
          </div>
        </div>

        <p v-if="data.bonusAwarded" class="mt-4 rounded-app-control bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Bonus streak : +{{ data.bonusAwarded }} crédits pour {{ data.milestoneReached }} jours consécutifs !
        </p>

        <AppUiButton class="mt-6 w-full" @click="close">
          Continuer
        </AppUiButton>
      </div>
    </div>
  </Teleport>
</template>
