<script setup lang="ts">
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { fr } from 'date-fns/locale'

export interface CalendarDaySummary {
  total: number
  pending: number
  overdue: number
  completed: number
  failed: number
}

const props = defineProps<{
  month: Date
  selectedDate: string
  daySummaries: Record<string, CalendarDaySummary>
}>()

const emit = defineEmits<{
  'update:month': [value: Date]
  'update:selectedDate': [value: string]
}>()

const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const monthLabel = computed(() =>
  format(props.month, 'MMMM yyyy', { locale: fr }),
)

const calendarDays = computed(() => {
  const monthStart = startOfMonth(props.month)
  const monthEnd = endOfMonth(props.month)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  return eachDayOfInterval({ start: gridStart, end: gridEnd })
})

const selectedDateObj = computed(() => new Date(`${props.selectedDate}T12:00:00`))

function toDateKey(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

function selectDay(date: Date) {
  emit('update:selectedDate', toDateKey(date))
  if (!isSameMonth(date, props.month)) {
    emit('update:month', startOfMonth(date))
  }
}

function previousMonth() {
  emit('update:month', subMonths(props.month, 1))
}

function nextMonth() {
  emit('update:month', addMonths(props.month, 1))
}

function goToToday() {
  const today = new Date()
  emit('update:month', startOfMonth(today))
  emit('update:selectedDate', toDateKey(today))
}

function dayDots(summary?: CalendarDaySummary) {
  if (!summary?.total) return []
  const dots: Array<'pending' | 'overdue' | 'completed' | 'failed'> = []
  if (summary.overdue) dots.push('overdue')
  if (summary.pending) dots.push('pending')
  if (summary.completed) dots.push('completed')
  if (summary.failed) dots.push('failed')
  return dots.slice(0, 3)
}

const dotClass: Record<string, string> = {
  pending: 'bg-focus-accent',
  overdue: 'bg-amber-500',
  completed: 'bg-emerald-500',
  failed: 'bg-red-500',
}
</script>

<template>
  <div class="focus-card overflow-hidden p-0">
    <div class="flex items-center justify-between border-b border-focus-gray-100 px-4 py-4 md:px-6">
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-full text-focus-gray-500 transition hover:bg-focus-gray-100 hover:text-focus-gray-900"
        aria-label="Mois précédent"
        @click="previousMonth"
      >
        ‹
      </button>

      <div class="text-center">
        <p class="text-base font-semibold capitalize text-focus-gray-900 md:text-lg">
          {{ monthLabel }}
        </p>
        <button
          type="button"
          class="mt-1 text-xs font-medium text-focus-accent transition hover:opacity-80"
          @click="goToToday"
        >
          Aujourd'hui
        </button>
      </div>

      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-full text-focus-gray-500 transition hover:bg-focus-gray-100 hover:text-focus-gray-900"
        aria-label="Mois suivant"
        @click="nextMonth"
      >
        ›
      </button>
    </div>

    <div class="grid grid-cols-7 border-b border-focus-gray-100 px-2 py-2 md:px-4">
      <div
        v-for="day in weekDays"
        :key="day"
        class="py-1 text-center text-[11px] font-medium uppercase tracking-wide text-focus-gray-400"
      >
        {{ day }}
      </div>
    </div>

    <div class="grid grid-cols-7 gap-1 p-2 md:gap-1.5 md:p-4">
      <button
        v-for="day in calendarDays"
        :key="toDateKey(day)"
        type="button"
        class="group relative flex min-h-[52px] flex-col items-center justify-center rounded-focus px-1 py-2 transition md:min-h-[64px]"
        :class="[
          isSameMonth(day, month)
            ? 'text-focus-gray-900 hover:bg-focus-gray-50'
            : 'text-focus-gray-300 hover:bg-focus-gray-50/60',
          isSameDay(day, selectedDateObj) && isSameMonth(day, month)
            ? '!bg-focus-black !text-white hover:!bg-focus-gray-800'
            : '',
          isToday(day) && !isSameDay(day, selectedDateObj)
            ? 'ring-1 ring-inset ring-focus-accent/40'
            : '',
        ]"
        @click="selectDay(day)"
      >
        <span
          class="text-sm font-medium md:text-base"
          :class="isSameDay(day, selectedDateObj) && isSameMonth(day, month) ? 'text-white' : ''"
        >
          {{ format(day, 'd') }}
        </span>

        <div
          v-if="daySummaries[toDateKey(day)]?.total"
          class="mt-1 flex items-center gap-0.5"
        >
          <span
            v-for="(dot, index) in dayDots(daySummaries[toDateKey(day)])"
            :key="`${toDateKey(day)}-${dot}-${index}`"
            class="h-1.5 w-1.5 rounded-full"
            :class="[
              dotClass[dot],
              isSameDay(day, selectedDateObj) && isSameMonth(day, month) ? 'opacity-90' : '',
            ]"
          />
        </div>
      </button>
    </div>

    <div class="flex flex-wrap items-center justify-center gap-4 border-t border-focus-gray-100 px-4 py-3 text-[11px] text-focus-gray-400">
      <span class="inline-flex items-center gap-1.5">
        <span class="h-1.5 w-1.5 rounded-full bg-focus-accent" /> À faire
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="h-1.5 w-1.5 rounded-full bg-amber-500" /> En retard
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Réussi
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="h-1.5 w-1.5 rounded-full bg-red-500" /> Échoué
      </span>
    </div>
  </div>
</template>
