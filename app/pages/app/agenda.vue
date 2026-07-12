<script setup lang="ts">
import { format, parseISO, startOfMonth } from 'date-fns'
import { fr } from 'date-fns/locale'
import OccurrenceCard from '~/components/OccurrenceCard.vue'
import type { OccurrenceItem } from '~/components/OccurrenceCard.vue'
import type { CalendarDaySummary } from '~/components/AppAgendaCalendar.vue'

definePageMeta({ layout: 'app', middleware: 'auth' })

type StatusFilter = 'all' | 'pending' | 'overdue' | 'completed' | 'failed'

const statusFilter = ref<StatusFilter>('all')
const { data: occurrencesData, isPending } = useOccurrences()

const currentMonth = ref(startOfMonth(new Date()))
const selectedDate = ref(format(new Date(), 'yyyy-MM-dd'))

const showCompleteModal = ref(false)
const selectedOccurrenceId = ref('')
const showCelebration = ref(false)
const celebrationData = ref<any>(null)

const statusFilters: Array<{ value: StatusFilter, label: string }> = [
  { value: 'all', label: 'Tous' },
  { value: 'pending', label: 'À faire' },
  { value: 'overdue', label: 'En retard' },
  { value: 'completed', label: 'Réussis' },
  { value: 'failed', label: 'Échoués' },
]

function isOverdue(occurrence: OccurrenceItem) {
  return occurrence.status === 'pending' && new Date(occurrence.dueAt) < new Date()
}

function matchesStatusFilter(occurrence: OccurrenceItem) {
  switch (statusFilter.value) {
    case 'pending':
      return occurrence.status === 'pending' && !isOverdue(occurrence)
    case 'overdue':
      return isOverdue(occurrence)
    case 'completed':
      return occurrence.status === 'completed'
    case 'failed':
      return occurrence.status === 'failed'
    default:
      return true
  }
}

const allOccurrences = computed(() => occurrencesData.value?.occurrences ?? [])

const filteredOccurrences = computed(() =>
  allOccurrences.value.filter(matchesStatusFilter),
)

const daySummaries = computed(() => {
  const summaries: Record<string, CalendarDaySummary> = {}

  for (const occurrence of filteredOccurrences.value) {
    const key = occurrence.dueDate
    if (!summaries[key]) {
      summaries[key] = { total: 0, pending: 0, overdue: 0, completed: 0, failed: 0 }
    }

    const summary = summaries[key]
    summary.total++

    if (occurrence.status === 'completed') summary.completed++
    else if (occurrence.status === 'failed') summary.failed++
    else if (isOverdue(occurrence)) summary.overdue++
    else if (occurrence.status === 'pending') summary.pending++
  }

  return summaries
})

const selectedDayOccurrences = computed(() =>
  filteredOccurrences.value
    .filter(occ => occ.dueDate === selectedDate.value)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()),
)

const selectedDayLabel = computed(() => {
  const date = parseISO(`${selectedDate.value}T12:00:00`)
  return format(date, "EEEE d MMMM", { locale: fr })
})

const monthOccurrenceCount = computed(() =>
  filteredOccurrences.value.filter((occ) => {
    const date = parseISO(`${occ.dueDate}T12:00:00`)
    return date.getFullYear() === currentMonth.value.getFullYear()
      && date.getMonth() === currentMonth.value.getMonth()
  }).length,
)

function onOccurrenceComplete(payload: { streak: any }) {
  if (payload.streak?.dailyPerfect) {
    celebrationData.value = {
      dailyPerfect: payload.streak.dailyPerfect,
      currentStreak: payload.streak.streak.currentStreak,
      longestStreak: payload.streak.streak.longestStreak,
      nextMilestone: payload.streak.streak.nextMilestone,
      progressToNext: payload.streak.streak.progressToNext,
      bonusAwarded: payload.streak.bonusAwarded,
      milestoneReached: payload.streak.milestoneReached,
    }
    showCelebration.value = true
  }
}

function openComplete(id: string) {
  selectedOccurrenceId.value = id
  showCompleteModal.value = true
}
</script>

<template>
  <div class="p-5 md:p-8">
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="focus-heading-lg">Agenda</h1>
        <p class="focus-body-sm mt-1">
          {{ monthOccurrenceCount }} échéance{{ monthOccurrenceCount > 1 ? 's' : '' }} ce mois-ci
        </p>
      </div>
    </div>

    <div class="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        v-for="item in statusFilters"
        :key="item.value"
        type="button"
        class="shrink-0 rounded-full px-4 py-2 text-sm font-medium transition"
        :class="statusFilter === item.value
          ? 'bg-focus-black text-white'
          : 'bg-focus-gray-100 text-focus-gray-600 hover:bg-focus-gray-200'"
        @click="statusFilter = item.value"
      >
        {{ item.label }}
      </button>
    </div>

    <div v-if="isPending" class="focus-card h-80 animate-pulse bg-focus-gray-50" />

    <template v-else>
      <AppAgendaCalendar
        v-model:month="currentMonth"
        v-model:selected-date="selectedDate"
        :day-summaries="daySummaries"
      />

      <div class="mt-6">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <p class="focus-label">Jour sélectionné</p>
            <h2 class="focus-heading-md capitalize">{{ selectedDayLabel }}</h2>
          </div>
          <UiBadge variant="neutral">
            {{ selectedDayOccurrences.length }} échéance{{ selectedDayOccurrences.length > 1 ? 's' : '' }}
          </UiBadge>
        </div>

        <div v-if="!selectedDayOccurrences.length" class="focus-card py-10 text-center">
          <p class="text-focus-gray-400">
            Aucune échéance pour ce jour
            <span v-if="statusFilter !== 'all'"> avec ce filtre</span>.
          </p>
        </div>

        <div v-else class="space-y-4">
          <OccurrenceCard
            v-for="occ in selectedDayOccurrences"
            :key="occ.id"
            :occurrence="occ"
            @complete="openComplete"
          />
        </div>
      </div>
    </template>

    <CompleteOccurrenceModal
      v-model="showCompleteModal"
      :occurrence-id="selectedOccurrenceId"
      :reward-credits="10"
      @success="onOccurrenceComplete"
    />

    <StreakCelebrationModal
      v-model="showCelebration"
      :data="celebrationData"
    />
  </div>
</template>
