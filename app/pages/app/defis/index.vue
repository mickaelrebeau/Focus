<script setup lang="ts">
import { format, parseISO } from 'date-fns'

definePageMeta({ layout: 'app', middleware: 'auth' })

type Metric = 'perfect_days' | 'completed_occurrences'
type Status = 'upcoming' | 'running' | 'finishing' | 'closed' | 'cancelled'

interface ChallengeSummary {
  id: string
  name: string
  metric: Metric
  weekStart: string
  weekEnd: string
  stakeCredits: number
  participants: number
  status: Status
}

const { t } = useI18n()
const { dateLocale } = useLanguage()
const { user, fetchUser } = useAuth()
const { data, refresh } = await useFetch<{ challenges: ChallengeSummary[] }>('/api/challenges', { credentials: 'include' })

const form = reactive({ name: '', week: 'current' as 'current' | 'next', metric: 'perfect_days' as Metric, stakeCredits: '0' })
const busy = ref(false)
const error = ref('')

const active = computed(() => data.value?.challenges.filter(c => c.status !== 'closed' && c.status !== 'cancelled') ?? [])
const past = computed(() => data.value?.challenges.filter(c => c.status === 'closed' || c.status === 'cancelled') ?? [])

function weekLabel(challenge: Pick<ChallengeSummary, 'weekStart' | 'weekEnd'>) {
  const start = format(parseISO(challenge.weekStart), 'd MMM', { locale: dateLocale.value })
  const end = format(parseISO(challenge.weekEnd), 'd MMM', { locale: dateLocale.value })
  return t('challenges.week', { start, end })
}

async function create() {
  error.value = ''
  busy.value = true
  try {
    const { id, token } = await $fetch<{ id: string, token: string }>('/api/challenges', {
      method: 'POST',
      credentials: 'include',
      body: { ...form, stakeCredits: Number(form.stakeCredits) },
    })
    // Le jeton n'est connu qu'à la création : transmis à la page du défi pour afficher le lien
    sessionStorage.setItem(`challenge-invite:${id}`, token)
    await fetchUser()
    await navigateTo(`/app/defis/${id}`)
  } catch (err: unknown) {
    const code = (err as { data?: { data?: { code?: string } } })?.data?.data?.code
    const message = (err as { data?: { message?: string } })?.data?.message
    error.value = code ? t(`challenges.errors.${code}`) : message ?? t('challenges.errors.generic')
  } finally {
    busy.value = false
    await refresh()
  }
}
</script>

<template>
  <div class="app-page animate-fade-in">
    <div class="mb-6">
      <p class="app-eyebrow">{{ t('challenges.eyebrow') }}</p>
      <h1 class="app-heading mt-1">{{ t('challenges.title') }}</h1>
      <p class="mt-1 text-sm text-app-secondary">{{ t('challenges.subtitle') }}</p>
    </div>

    <AppUiCard v-if="active.length" :title="t('challenges.activeTitle')" class="mb-4">
      <ul class="divide-y divide-app-line">
        <li v-for="challenge in active" :key="challenge.id">
          <NuxtLink :to="`/app/defis/${challenge.id}`" class="flex items-center justify-between gap-3 py-3">
            <div class="min-w-0">
              <p class="truncate font-semibold text-app-ink">{{ challenge.name }}</p>
              <p class="text-xs text-app-secondary">
                {{ weekLabel(challenge) }} · {{ t(`challenges.metrics.${challenge.metric}`) }} · {{ t('challenges.participantsCount', challenge.participants) }}
              </p>
            </div>
            <span class="app-chip shrink-0">{{ t(`challenges.status.${challenge.status}`) }}</span>
          </NuxtLink>
        </li>
      </ul>
    </AppUiCard>

    <AppUiCard :title="t('challenges.createTitle')">
      <form class="space-y-4" @submit.prevent="create">
        <AppUiInput v-model="form.name" :label="t('challenges.name')" :placeholder="t('challenges.namePlaceholder')" required />
        <div class="grid gap-4 sm:grid-cols-2">
          <AppUiSelect v-model="form.week" :label="t('challenges.weekLabel')">
            <option value="current">{{ t('challenges.weeks.current') }}</option>
            <option value="next">{{ t('challenges.weeks.next') }}</option>
          </AppUiSelect>
          <AppUiSelect v-model="form.metric" :label="t('challenges.metricLabel')">
            <option value="perfect_days">{{ t('challenges.metrics.perfect_days') }}</option>
            <option value="completed_occurrences">{{ t('challenges.metrics.completed_occurrences') }}</option>
          </AppUiSelect>
        </div>
        <AppUiSelect v-model="form.stakeCredits" :label="t('challenges.stakeLabel')">
          <option value="0">{{ t('challenges.noStake') }}</option>
          <option v-for="stake in [10, 20, 50]" :key="stake" :value="String(stake)">{{ t('challenges.stakeOption', { n: stake }) }}</option>
        </AppUiSelect>
        <p class="text-xs text-app-secondary">
          {{ t('challenges.stakeHint', { balance: user?.credits ?? 0 }) }}
        </p>
        <AppUiButton type="submit" :loading="busy">{{ t('challenges.create') }}</AppUiButton>
        <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
      </form>
    </AppUiCard>

    <AppUiCard v-if="past.length" :title="t('challenges.pastTitle')" class="mt-4">
      <ul class="divide-y divide-app-line">
        <li v-for="challenge in past" :key="challenge.id">
          <NuxtLink :to="`/app/defis/${challenge.id}`" class="flex items-center justify-between gap-3 py-3">
            <div class="min-w-0">
              <p class="truncate font-semibold text-app-ink">{{ challenge.name }}</p>
              <p class="text-xs text-app-secondary">{{ weekLabel(challenge) }}</p>
            </div>
            <span class="app-chip shrink-0">{{ t(`challenges.status.${challenge.status}`) }}</span>
          </NuxtLink>
        </li>
      </ul>
    </AppUiCard>
  </div>
</template>
