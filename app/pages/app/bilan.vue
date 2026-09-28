<script setup lang="ts">
import { format, parseISO } from 'date-fns'

definePageMeta({ layout: 'app', middleware: 'auth' })

type DayStatus = 'success' | 'failed' | 'paused' | 'neutral'

interface ReviewResponse {
  review: {
    week: { start: string, end: string }
    occurrences: { total: number, completed: number, failed: number, pending: number, paused: number, successRate: number | null }
    days: { perfect: number, failed: number, paused: number, list: Array<{ date: string, status: DayStatus }> }
    credits: { gained: number, lost: number, net: number }
    consequences: { total: number, byProvider: Record<string, number> }
    bestStreak: number
  }
  previousWeek: string
  nextWeek: string | null
  isCurrentWeek: boolean
}

const route = useRoute()
const { t } = useI18n()
const { dateLocale } = useLanguage()
const { typeName } = useConsequenceText()

const week = computed(() => (typeof route.query.week === 'string' ? route.query.week : undefined))
const { data } = await useFetch<ReviewResponse>('/api/bilan', {
  query: { week },
  credentials: 'include',
})

const review = computed(() => data.value?.review)
const feedback = ref('')

const weekLabel = computed(() => {
  if (!review.value) return ''
  const start = parseISO(review.value.week.start)
  const end = parseISO(review.value.week.end)
  return t('review.weekOf', {
    start: format(start, 'd MMMM', { locale: dateLocale.value }),
    end: format(end, 'd MMMM yyyy', { locale: dateLocale.value }),
  })
})

const dayStyles: Record<DayStatus, string> = {
  success: 'bg-app-ink text-white',
  failed: 'bg-white text-app-ink ring-2 ring-inset ring-app-ink',
  paused: 'bg-app-mist text-app-secondary',
  neutral: 'bg-white text-app-secondary ring-1 ring-inset ring-app-line',
}

function dayLetter(date: string) {
  return format(parseISO(date), 'EEEEE', { locale: dateLocale.value }).toUpperCase()
}

const exportUrl = computed(() => `/api/bilan/export?week=${review.value?.week.start ?? ''}`)

function shareText() {
  const r = review.value!
  const lines = [
    t('review.shareTitle', { week: weekLabel.value }),
    r.occurrences.successRate === null
      ? t('review.shareNoClosed')
      : t('review.shareRate', { rate: r.occurrences.successRate, completed: r.occurrences.completed, closed: r.occurrences.completed + r.occurrences.failed }),
    t('review.sharePerfect', r.days.perfect),
    t('review.shareStreak', r.bestStreak),
  ]
  return lines.join('\n')
}

async function share() {
  feedback.value = ''
  const text = shareText()
  try {
    if (navigator.share) {
      await navigator.share({ title: t('review.title'), text })
      return
    }
    await navigator.clipboard.writeText(text)
    feedback.value = t('review.copied')
  } catch {
    // Partage annulé par l'utilisateur : rien à signaler
  }
}
</script>

<template>
  <div class="app-page animate-fade-in">
    <div class="mb-6">
      <p class="app-eyebrow">{{ t('review.eyebrow') }}</p>
      <h1 class="app-heading mt-1">{{ t('review.title') }}</h1>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <NuxtLink
          v-if="data"
          :to="{ query: { week: data.previousWeek } }"
          class="flex h-10 w-10 items-center justify-center rounded-full text-app-secondary ring-1 ring-inset ring-app-line hover:text-app-ink"
          :aria-label="t('review.previous')"
        >
          ‹
        </NuxtLink>
        <p class="min-w-0 text-sm font-semibold text-app-ink" data-testid="week-label">{{ weekLabel }}</p>
        <NuxtLink
          v-if="data?.nextWeek"
          :to="{ query: { week: data.nextWeek } }"
          class="flex h-10 w-10 items-center justify-center rounded-full text-app-secondary ring-1 ring-inset ring-app-line hover:text-app-ink"
          :aria-label="t('review.next')"
        >
          ›
        </NuxtLink>
        <span v-if="data?.isCurrentWeek" class="app-chip-neutral">{{ t('review.inProgress') }}</span>
      </div>
    </div>

    <template v-if="review">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="app-sheet p-5" data-testid="stat-rate">
          <p class="text-xs font-medium text-app-secondary">{{ t('review.successRate') }}</p>
          <p class="mt-2 text-3xl font-semibold tracking-tight text-app-ink">
            {{ review.occurrences.successRate === null ? '—' : `${review.occurrences.successRate} %` }}
          </p>
          <p class="mt-1 text-xs text-app-secondary">
            {{ t('review.rateDetail', { completed: review.occurrences.completed, closed: review.occurrences.completed + review.occurrences.failed }) }}
          </p>
        </div>
        <div class="app-sheet p-5" data-testid="stat-days">
          <p class="text-xs font-medium text-app-secondary">{{ t('review.perfectDays') }}</p>
          <p class="mt-2 text-3xl font-semibold tracking-tight text-app-ink">{{ review.days.perfect }}</p>
          <p class="mt-1 text-xs text-app-secondary">{{ t('review.failedDays', review.days.failed) }}</p>
        </div>
        <div class="app-sheet p-5" data-testid="stat-credits">
          <p class="text-xs font-medium text-app-secondary">{{ t('review.credits') }}</p>
          <p class="mt-2 text-3xl font-semibold tracking-tight text-app-ink">
            {{ review.credits.net > 0 ? '+' : '' }}{{ review.credits.net }}
          </p>
          <p class="mt-1 text-xs text-app-secondary">
            {{ t('review.creditsDetail', { gained: review.credits.gained, lost: review.credits.lost }) }}
          </p>
        </div>
        <div class="app-sheet p-5" data-testid="stat-streak">
          <p class="text-xs font-medium text-app-secondary">{{ t('review.bestStreak') }}</p>
          <p class="mt-2 text-3xl font-semibold tracking-tight text-app-ink">{{ review.bestStreak }}</p>
          <p class="mt-1 text-xs text-app-secondary">{{ t('review.bestStreakDetail', review.bestStreak) }}</p>
        </div>
      </div>

      <AppUiCard :title="t('review.daysTitle')" class="mt-4">
        <ol class="grid grid-cols-7 gap-2">
          <li v-for="day in review.days.list" :key="day.date" class="flex flex-col items-center gap-1.5">
            <span
              class="flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold"
              :class="dayStyles[day.status]"
              :title="t(`review.day.${day.status}`)"
            >
              {{ dayLetter(day.date) }}
            </span>
            <span class="sr-only">{{ day.date }} : {{ t(`review.day.${day.status}`) }}</span>
          </li>
        </ol>
        <p class="mt-4 text-xs text-app-secondary">
          {{ t('review.occurrencesDetail', { total: review.occurrences.total, pending: review.occurrences.pending, paused: review.occurrences.paused }) }}
        </p>
      </AppUiCard>

      <AppUiCard :title="t('review.consequencesTitle')" class="mt-4" data-testid="consequences">
        <p v-if="!review.consequences.total" class="text-sm text-app-secondary">{{ t('review.noConsequences') }}</p>
        <ul v-else class="space-y-1.5 text-sm">
          <li v-for="(count, provider) in review.consequences.byProvider" :key="provider" class="flex justify-between">
            <span class="text-app-ink">{{ typeName(String(provider)) }}</span>
            <span class="font-semibold text-app-ink">× {{ count }}</span>
          </li>
        </ul>
      </AppUiCard>

      <div class="mt-6 flex flex-wrap items-center gap-3">
        <AppUiButton @click="share">{{ t('review.share') }}</AppUiButton>
        <a :href="exportUrl" class="app-button-secondary inline-flex" download>{{ t('review.exportCsv') }}</a>
        <p v-if="feedback" role="status" class="text-sm text-emerald-600">{{ feedback }}</p>
      </div>
    </template>
  </div>
</template>
