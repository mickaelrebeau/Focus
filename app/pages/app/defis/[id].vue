<script setup lang="ts">
import { format, parseISO } from 'date-fns'
import { HugeiconsIcon } from '@hugeicons/vue'
import { Medal01Icon, Medal02Icon, Medal03Icon } from '@hugeicons/core-free-icons'

definePageMeta({ layout: 'app', middleware: 'auth' })

interface ChallengeDetail {
  id: string
  name: string
  metric: 'perfect_days' | 'completed_occurrences'
  weekStart: string
  weekEnd: string
  stakeCredits: number
  pot: number
  maxParticipants: number
  status: 'upcoming' | 'running' | 'finishing' | 'closed' | 'cancelled'
  isCreator: boolean
  ranking: Array<{ displayName: string, score: number, rank: number, payout: number | null, isMe: boolean }>
}

const route = useRoute()
const id = String(route.params.id)
const { t } = useI18n()
const { dateLocale } = useLanguage()
const { fetchUser } = useAuth()
const { data, error: loadError, refresh } = await useFetch<ChallengeDetail>(`/api/challenges/${id}`, { credentials: 'include' })

const inviteLink = ref('')
const busy = ref(false)
const feedback = ref('')
const error = ref('')

const medals = [Medal01Icon, Medal02Icon, Medal03Icon]
const open = computed(() => data.value && (data.value.status === 'upcoming' || data.value.status === 'running'))
const participantCount = computed(() => data.value?.ranking.length ?? 0)

onMounted(() => {
  const key = `challenge-invite:${id}`
  const token = sessionStorage.getItem(key)
  if (token) {
    inviteLink.value = `${window.location.origin}/defis/rejoindre/${token}`
    sessionStorage.removeItem(key)
  }
})

function weekLabel(detail: ChallengeDetail) {
  const start = format(parseISO(detail.weekStart), 'EEEE d MMM', { locale: dateLocale.value })
  const end = format(parseISO(detail.weekEnd), 'EEEE d MMM', { locale: dateLocale.value })
  return t('challenges.week', { start, end })
}

async function run(action: () => Promise<unknown>) {
  error.value = ''
  feedback.value = ''
  busy.value = true
  try {
    await action()
    await refresh()
  } catch (err: unknown) {
    const code = (err as { data?: { data?: { code?: string } } })?.data?.data?.code
    error.value = code ? t(`challenges.errors.${code}`) : t('challenges.errors.generic')
  } finally {
    busy.value = false
  }
}

function newLink() {
  return run(async () => {
    const { token } = await $fetch<{ token: string }>(`/api/challenges/${id}/invite`, { method: 'POST', credentials: 'include' })
    inviteLink.value = `${window.location.origin}/defis/rejoindre/${token}`
  })
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    feedback.value = t('challenges.copied')
  } catch {
    // Copie refusée : le lien reste sélectionnable
  }
}

function leave() {
  if (!data.value) return
  const refundable = data.value.status === 'upcoming' && data.value.stakeCredits > 0
  if (!window.confirm(refundable ? t('challenges.confirmLeaveRefund') : t('challenges.confirmLeave'))) return
  return run(async () => {
    await $fetch(`/api/challenges/${id}/leave`, { method: 'POST', credentials: 'include' })
    await fetchUser()
    await navigateTo('/app/defis')
  })
}
</script>

<template>
  <div class="app-page animate-fade-in">
    <NuxtLink to="/app/defis" class="text-sm text-app-secondary hover:text-app-ink">{{ t('challenges.back') }}</NuxtLink>

    <template v-if="data">
      <div class="mb-6 mt-3">
        <p class="app-eyebrow">{{ t(`challenges.status.${data.status}`) }}</p>
        <h1 class="app-heading mt-1">{{ data.name }}</h1>
        <p class="mt-1 text-sm first-letter:uppercase text-app-secondary">{{ weekLabel(data) }}</p>
      </div>

      <div class="mb-4 grid grid-cols-3 gap-3">
        <AppUiCard>
          <p class="text-xs text-app-secondary">{{ t('challenges.metricLabel') }}</p>
          <p class="mt-1 text-sm font-semibold text-app-ink">{{ t(`challenges.metrics.${data.metric}`) }}</p>
        </AppUiCard>
        <AppUiCard>
          <p class="text-xs text-app-secondary">{{ t('challenges.pot') }}</p>
          <p class="mt-1 text-sm font-semibold text-app-ink" data-testid="challenge-pot">{{ t('challenges.credits', { n: data.pot }) }}</p>
        </AppUiCard>
        <AppUiCard>
          <p class="text-xs text-app-secondary">{{ t('challenges.participants') }}</p>
          <p class="mt-1 text-sm font-semibold text-app-ink">{{ participantCount }} / {{ data.maxParticipants }}</p>
        </AppUiCard>
      </div>

      <AppUiCard :title="data.status === 'closed' ? t('challenges.finalRanking') : t('challenges.liveRanking')">
        <p v-if="data.status === 'cancelled'" class="text-sm text-app-secondary">{{ t('challenges.cancelledExplain') }}</p>
        <ol v-else class="divide-y divide-app-line" data-testid="challenge-ranking">
          <li
            v-for="entry in data.ranking"
            :key="`${entry.rank}-${entry.displayName}`"
            class="flex items-center gap-3 py-3"
            :class="{ 'font-semibold': entry.isMe }"
          >
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-mist text-sm text-app-ink">
              <HugeiconsIcon v-if="entry.rank <= 3 && entry.score > 0" :icon="medals[entry.rank - 1]" :size="18" :stroke-width="1.8" aria-hidden="true" />
              <span v-else>{{ entry.rank }}</span>
            </span>
            <span class="sr-only">{{ t('challenges.rank', { n: entry.rank }) }}</span>
            <span class="min-w-0 flex-1 truncate text-app-ink">
              {{ entry.displayName }}<span v-if="entry.isMe" class="text-app-secondary"> {{ t('challenges.you') }}</span>
            </span>
            <span class="text-sm text-app-ink">{{ t(`challenges.score.${data.metric}`, entry.score) }}</span>
            <span v-if="entry.payout" class="app-chip">+{{ entry.payout }}</span>
          </li>
        </ol>
        <p v-if="data.status === 'running' || data.status === 'upcoming'" class="mt-4 text-xs text-app-secondary">
          {{ t('challenges.rules', { n: data.stakeCredits }) }}
        </p>
        <p v-else-if="data.status === 'finishing'" class="mt-4 text-xs text-app-secondary">{{ t('challenges.finishing') }}</p>
      </AppUiCard>

      <AppUiCard v-if="open" :title="t('challenges.inviteTitle')" class="mt-4">
        <div class="space-y-3 text-sm">
          <p class="text-app-secondary">{{ t('challenges.inviteExplain') }}</p>
          <div v-if="inviteLink" class="space-y-2">
            <label for="challenge-invite-link" class="text-sm font-semibold text-app-ink">{{ t('challenges.linkLabel') }}</label>
            <div class="flex gap-2">
              <input id="challenge-invite-link" :value="inviteLink" readonly class="app-input flex-1" @focus="($event.target as HTMLInputElement).select()">
              <AppUiButton variant="secondary" @click="copyLink">{{ t('challenges.copy') }}</AppUiButton>
            </div>
          </div>
          <AppUiButton variant="secondary" :loading="busy" @click="newLink">{{ t('challenges.newLink') }}</AppUiButton>
        </div>
      </AppUiCard>

      <div v-if="open" class="mt-4">
        <AppUiButton variant="ghost" class="!text-red-500" :disabled="busy" @click="leave">{{ t('challenges.leave') }}</AppUiButton>
      </div>

      <div class="mt-4">
        <p v-if="feedback" role="status" class="text-sm text-emerald-600">{{ feedback }}</p>
        <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
      </div>
    </template>

    <p v-else-if="loadError" class="mt-6 text-sm text-app-secondary">{{ t('challenges.errors.not_participant') }}</p>
  </div>
</template>
