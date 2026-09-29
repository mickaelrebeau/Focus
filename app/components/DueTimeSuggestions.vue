<script setup lang="ts">
import { DUE_TIME_SLOTS, DUE_TIME_SLOT_IDS, presetsForCategory, slotForTime, type DueTimeSlotId } from '#shared/due-time-slots'

// Heure limite : créneaux suggérés (catégorie, puis créneaux génériques) et taux de
// réussite de l'utilisateur par créneau, avec une suggestion quand l'historique suffit.
const props = defineProps<{ category: string }>()
const dueTime = defineModel<string>({ required: true })
const { t } = useI18n()

interface SlotStats {
  scope: 'category' | 'all'
  slots: Array<{ slot: DueTimeSlotId, total: number, rate: number | null }>
  suggestion: { slot: DueTimeSlotId, rate: number, time: string } | null
}

const HISTORY_DAYS = 90
const category = refDebounced(computed(() => props.category.trim()), 400)
const { data: stats } = useFetch<SlotStats>('/api/time-slots', {
  query: computed(() => (category.value ? { category: category.value } : {})),
  server: false,
  credentials: 'include',
})

const categoryPresets = computed(() => presetsForCategory(category.value))
const genericPresets = computed(() =>
  DUE_TIME_SLOT_IDS.map(slot => DUE_TIME_SLOTS[slot].defaultTime).filter(time => !categoryPresets.value.includes(time)),
)
const comparedSlots = computed(() => stats.value?.slots.filter(slot => slot.rate !== null) ?? [])

function chipLabel(time: string) {
  return `${t(`dueTimes.slots.${slotForTime(time)}`)} · ${time}`
}
</script>

<template>
  <div class="space-y-3" data-testid="due-time-suggestions">
    <div>
      <p class="text-xs font-semibold text-app-secondary">
        {{ categoryPresets.length ? t('dueTimes.forCategory', { category }) : t('dueTimes.suggested') }}
      </p>
      <div class="mt-1.5 flex flex-wrap gap-2">
        <button
          v-for="time in [...categoryPresets, ...genericPresets]"
          :key="time"
          type="button"
          class="transition"
          :class="dueTime === time ? 'app-chip' : 'app-chip-neutral'"
          :aria-pressed="dueTime === time"
          @click="dueTime = time"
        >
          {{ chipLabel(time) }}
        </button>
      </div>
    </div>

    <div v-if="stats" class="rounded-app-control bg-app-canvas px-4 py-3 text-sm">
      <p class="font-semibold text-app-ink">{{ t('dueTimes.statsTitle') }}</p>
      <p class="text-xs text-app-secondary">
        {{ stats.scope === 'category'
          ? t('dueTimes.statsScopeCategory', { category, days: HISTORY_DAYS })
          : t('dueTimes.statsScopeAll', { days: HISTORY_DAYS }) }}
      </p>
      <template v-if="stats.suggestion">
        <ul class="mt-2 space-y-1">
          <li v-for="slot in comparedSlots" :key="slot.slot" class="flex items-center gap-3 text-xs">
            <span class="w-20 text-app-secondary">{{ t(`dueTimes.slots.${slot.slot}`) }}</span>
            <span class="app-progress flex-1" aria-hidden="true">
              <span class="app-progress-bar block" :style="{ width: `${slot.rate}%` }" />
            </span>
            <span class="w-24 text-right text-app-ink">{{ slot.rate }} % · {{ t('dueTimes.samples', slot.total) }}</span>
          </li>
        </ul>
        <button
          type="button"
          class="mt-3 text-sm font-semibold text-app-ink underline underline-offset-2"
          @click="dueTime = stats.suggestion.time"
        >
          {{ t('dueTimes.suggestion', {
            time: stats.suggestion.time,
            slot: t(`dueTimes.slots.${stats.suggestion.slot}`).toLowerCase(),
            rate: stats.suggestion.rate,
          }) }}
        </button>
      </template>
      <p v-else class="mt-1 text-xs text-app-secondary">{{ t('dueTimes.notEnoughData') }}</p>
    </div>
  </div>
</template>
