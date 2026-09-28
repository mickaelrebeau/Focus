<script setup lang="ts">
import { addDays, format, parseISO } from 'date-fns'
import { useQueryClient } from '@tanstack/vue-query'

definePageMeta({ layout: 'app', middleware: 'auth' })

type PauseStatus = 'upcoming' | 'active' | 'ended' | 'cancelled'

interface PauseItem {
  id: string
  startDate: string
  endDate: string
  originalEndDate: string | null
  reason: string | null
  status: PauseStatus
}

interface PausesResponse {
  today: string
  maxDays: number
  pauses: PauseItem[]
}

const { t } = useI18n()
const { dateLocale } = useLanguage()
const { fetchUser } = useAuth()
const queryClient = useQueryClient()

const { data, refresh } = await useFetch<PausesResponse>('/api/pauses', { credentials: 'include' })

const startDate = ref('')
const endDate = ref('')
const reason = ref('')
const saving = ref(false)
const endingId = ref<string | null>(null)
const feedback = ref('')
const error = ref('')

watchEffect(() => {
  if (data.value && !startDate.value) {
    startDate.value = data.value.today
    endDate.value = format(addDays(parseISO(data.value.today), 6), 'yyyy-MM-dd')
  }
})

const maxEndDate = computed(() => {
  if (!startDate.value || !data.value) return undefined
  return format(addDays(parseISO(startDate.value), data.value.maxDays - 1), 'yyyy-MM-dd')
})

const hasOpenPause = computed(() => data.value?.pauses.some(p => p.status === 'active' || p.status === 'upcoming'))

const statusVariant: Record<PauseStatus, 'success' | 'neutral' | 'warning'> = {
  active: 'success',
  upcoming: 'warning',
  ended: 'neutral',
  cancelled: 'neutral',
}

function formatDate(value: string) {
  return format(parseISO(value), 'd MMMM yyyy', { locale: dateLocale.value })
}

function errorMessage(err: unknown, fallbackKey: string) {
  const fetchError = err as { data?: { data?: { code?: string }, message?: string } }
  const code = fetchError?.data?.data?.code
  if (code) return t(`pause.errors.${code}`, { max: data.value?.maxDays ?? 60 })
  return fetchError?.data?.message ?? t(fallbackKey)
}

async function afterChange() {
  await Promise.all([refresh(), fetchUser()])
  // Les échéances ont changé de statut (« en pause » / « à faire »)
  await queryClient.invalidateQueries({ queryKey: ['occurrences'] })
}

async function createPause() {
  error.value = ''
  feedback.value = ''
  saving.value = true
  try {
    const result = await $fetch<{ skipped: number }>('/api/pauses', {
      method: 'POST',
      body: { startDate: startDate.value, endDate: endDate.value, reason: reason.value || undefined },
      credentials: 'include',
    })
    feedback.value = t('pause.created', result.skipped)
    reason.value = ''
    await afterChange()
  } catch (err) {
    error.value = errorMessage(err, 'pause.errors.generic')
  } finally {
    saving.value = false
  }
}

async function endPause(pause: PauseItem) {
  error.value = ''
  feedback.value = ''
  endingId.value = pause.id
  try {
    const result = await $fetch<{ status: 'cancelled' | 'ended' }>(`/api/pauses/${pause.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    feedback.value = t(result.status === 'cancelled' ? 'pause.cancelledFeedback' : 'pause.endedFeedback')
    await afterChange()
  } catch (err) {
    error.value = errorMessage(err, 'pause.errors.generic')
  } finally {
    endingId.value = null
  }
}
</script>

<template>
  <div class="app-page animate-fade-in">
    <div class="mb-6">
      <NuxtLink
        to="/app/reglages"
        class="mb-3 inline-flex text-sm font-medium text-app-secondary hover:text-app-blue"
      >
        {{ t('consequences.back') }}
      </NuxtLink>
      <p class="app-eyebrow">{{ t('pause.eyebrow') }}</p>
      <h1 class="app-heading mt-1">{{ t('pause.title') }}</h1>
      <p class="mt-1 text-sm text-app-secondary">{{ t('pause.subtitle') }}</p>
    </div>

    <AppUiCard :title="t('pause.rulesTitle')">
      <ul class="list-disc space-y-1.5 pl-5 text-sm text-app-secondary">
        <li>{{ t('pause.ruleSkipped') }}</li>
        <li>{{ t('pause.ruleStreak') }}</li>
        <li>{{ t('pause.ruleLimits', { max: data?.maxDays ?? 60 }) }}</li>
      </ul>
    </AppUiCard>

    <AppUiCard :title="t('pause.planTitle')" class="mt-4">
      <p v-if="hasOpenPause" class="text-sm text-app-secondary">{{ t('pause.alreadyPlanned') }}</p>
      <form v-else class="space-y-4" @submit.prevent="createPause">
        <div class="grid gap-4 sm:grid-cols-2">
          <AppUiInput v-model="startDate" :label="t('pause.startDate')" type="date" required :min="data?.today" />
          <AppUiInput v-model="endDate" :label="t('pause.endDate')" type="date" required :min="startDate" :max="maxEndDate" />
        </div>
        <AppUiInput v-model="reason" :label="t('pause.reason')" :placeholder="t('pause.reasonPlaceholder')" />
        <AppUiButton type="submit" :loading="saving">{{ t('pause.submit') }}</AppUiButton>
      </form>
    </AppUiCard>

    <AppUiCard :title="t('pause.historyTitle')" class="mt-4">
      <p v-if="!data?.pauses.length" class="text-sm text-app-secondary">{{ t('pause.historyEmpty') }}</p>
      <ul v-else class="divide-y divide-app-line/60">
        <li v-for="pause in data.pauses" :key="pause.id" class="flex flex-wrap items-center justify-between gap-3 py-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="text-sm font-semibold text-app-ink">
                {{ t('pause.range', { start: formatDate(pause.startDate), end: formatDate(pause.endDate) }) }}
              </p>
              <AppUiBadge :variant="statusVariant[pause.status]">{{ t(`pause.status.${pause.status}`) }}</AppUiBadge>
            </div>
            <p v-if="pause.reason" class="mt-0.5 text-xs text-app-secondary">{{ pause.reason }}</p>
            <p v-if="pause.originalEndDate" class="mt-0.5 text-xs text-app-secondary">
              {{ t('pause.endedEarly', { date: formatDate(pause.originalEndDate) }) }}
            </p>
          </div>
          <AppUiButton
            v-if="pause.status === 'active' || pause.status === 'upcoming'"
            variant="secondary"
            :loading="endingId === pause.id"
            @click="endPause(pause)"
          >
            {{ pause.status === 'active' ? t('pause.endNow') : t('pause.cancel') }}
          </AppUiButton>
        </li>
      </ul>
    </AppUiCard>

    <div class="mt-6">
      <p v-if="feedback" role="status" class="text-sm text-emerald-600">{{ feedback }}</p>
      <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
    </div>
  </div>
</template>
