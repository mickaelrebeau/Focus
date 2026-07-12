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
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      @click.self="close"
    >
      <div
        ref="modalRef"
        class="w-full max-w-md overflow-hidden rounded-focus-xl bg-gradient-to-br from-focus-gray-900 to-focus-gray-800 p-6 text-white shadow-focus-lg"
      >
        <p class="text-xs font-medium uppercase tracking-wider text-amber-300">Journée parfaite</p>
        <h3 class="mt-2 text-3xl font-semibold">
          <span class="bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">
            {{ data.currentStreak }} jour{{ data.currentStreak > 1 ? 's' : '' }}
          </span>
          d'affilée
        </h3>
        <p class="mt-2 text-sm text-white/70">
          Toutes vos missions du jour sont validées. Continuez sur cette lancée !
        </p>

        <div class="mt-6 rounded-focus bg-white/10 px-4 py-3">
          <div class="flex items-center justify-between text-sm">
            <span class="text-white/70">Record personnel</span>
            <span class="font-semibold">{{ data.longestStreak }} jour{{ data.longestStreak > 1 ? 's' : '' }}</span>
          </div>
          <div class="mt-3">
            <div class="mb-1 flex justify-between text-xs text-white/60">
              <span>Prochain palier</span>
              <span>{{ data.progressToNext }}/7 → {{ data.nextMilestone }} jours</span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                class="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700"
                :style="{ width: `${progressPercent}%` }"
              />
            </div>
          </div>
        </div>

        <p v-if="data.bonusAwarded" class="mt-4 rounded-focus bg-emerald-500/20 px-4 py-3 text-sm text-emerald-200">
          Bonus streak : +{{ data.bonusAwarded }} crédits pour {{ data.milestoneReached }} jours consécutifs !
        </p>

        <UiButton class="mt-6 w-full" @click="close">
          Continuer
        </UiButton>
      </div>
    </div>
  </Teleport>
</template>
