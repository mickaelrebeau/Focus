<script setup lang="ts">
import { format, parseISO } from 'date-fns'

definePageMeta({ layout: 'app', middleware: 'auth' })

type DayStatus = 'success' | 'failed' | 'late' | 'in_progress' | 'rest' | 'paused'
type HistoryStatus = 'success' | 'failed' | 'neutral' | 'paused'

interface PartnershipState {
  partner: {
    partnershipId: string
    since: string | null
    partner: { displayName: string }
    today: { date: string, status: DayStatus, total: number, completed: number }
    streak: number
    history: Array<{ date: string, status: HistoryStatus }>
  } | null
  invitation: { id: string, expiresAt: string } | null
}

const { t } = useI18n()
const { dateLocale } = useLanguage()
const { data, refresh } = await useFetch<PartnershipState>('/api/partnerships', { credentials: 'include' })

const inviteLink = ref('')
const busy = ref(false)
const feedback = ref('')
const error = ref('')

const dayStyles: Record<DayStatus, string> = {
  success: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-600',
  late: 'bg-amber-50 text-amber-700',
  in_progress: 'bg-app-mist text-app-ink',
  rest: 'bg-app-mist text-app-secondary',
  paused: 'bg-sky-50 text-sky-800',
}

const dotStyles: Record<HistoryStatus, string> = {
  success: 'bg-emerald-500',
  failed: 'bg-red-500',
  neutral: 'bg-slate-200',
  paused: 'bg-sky-300',
}

function dayLabel(date: string) {
  return format(parseISO(date), 'EEE d', { locale: dateLocale.value })
}

async function run(action: () => Promise<unknown>, successKey?: string) {
  error.value = ''
  feedback.value = ''
  busy.value = true
  try {
    await action()
    if (successKey) feedback.value = t(successKey)
    await refresh()
  } catch (err: unknown) {
    const code = (err as { data?: { data?: { code?: string } } })?.data?.data?.code
    error.value = code ? t(`partner.errors.${code}`) : t('partner.errors.generic')
  } finally {
    busy.value = false
  }
}

function createInvite() {
  return run(async () => {
    const { token } = await $fetch<{ token: string }>('/api/partnerships/invitations', {
      method: 'POST',
      credentials: 'include',
    })
    inviteLink.value = `${window.location.origin}/binome/${token}`
  })
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    feedback.value = t('partner.copied')
  } catch {
    // Copie refusée : le lien reste sélectionnable
  }
}

function revoke(id: string, successKey: string) {
  if (successKey === 'partner.revoked' && !window.confirm(t('partner.confirmRevoke'))) return
  inviteLink.value = ''
  const url: string = `/api/partnerships/${id}`
  return run(() => $fetch<{ revoked: boolean }>(url, { method: 'DELETE', credentials: 'include' }), successKey)
}
</script>

<template>
  <div class="app-page animate-fade-in">
    <div class="mb-6">
      <p class="app-eyebrow">{{ t('partner.eyebrow') }}</p>
      <h1 class="app-heading mt-1">{{ t('partner.title') }}</h1>
      <p class="mt-1 text-sm text-app-secondary">{{ t('partner.subtitle') }}</p>
    </div>

    <!-- Binôme actif : sa vue minimale -->
    <template v-if="data?.partner">
      <AppUiCard>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-xs font-medium text-app-secondary">{{ t('partner.yourPartner') }}</p>
            <p class="mt-0.5 text-xl font-semibold tracking-tight text-app-ink">{{ data.partner.partner.displayName }}</p>
          </div>
          <span class="app-chip">{{ t('partner.streak', data.partner.streak) }}</span>
        </div>

        <div class="mt-5 rounded-app-control px-4 py-4" :class="dayStyles[data.partner.today.status]" data-testid="partner-today">
          <p class="text-xs font-semibold uppercase tracking-wide opacity-80">{{ t('partner.today') }}</p>
          <p class="mt-1 text-lg font-semibold">{{ t(`partner.status.${data.partner.today.status}`) }}</p>
          <p v-if="data.partner.today.total > 0" class="mt-0.5 text-sm opacity-90">
            {{ t('partner.progress', { completed: data.partner.today.completed, total: data.partner.today.total }) }}
          </p>
        </div>

        <div class="mt-5">
          <p class="text-xs font-medium text-app-secondary">{{ t('partner.lastDays') }}</p>
          <ol class="mt-2 grid grid-cols-7 gap-1.5">
            <li v-for="day in data.partner.history" :key="day.date" class="flex flex-col items-center gap-1.5">
              <span class="h-3 w-3 rounded-full" :class="dotStyles[day.status]" :title="t(`partner.history.${day.status}`)" />
              <span class="text-[11px] capitalize text-app-secondary">{{ dayLabel(day.date) }}</span>
              <span class="sr-only">{{ t(`partner.history.${day.status}`) }}</span>
            </li>
          </ol>
        </div>

        <p class="mt-5 text-xs text-app-secondary">{{ t('partner.privacy') }}</p>
      </AppUiCard>

      <div class="mt-4">
        <AppUiButton variant="ghost" class="!text-red-500" :disabled="busy" @click="revoke(data.partner.partnershipId, 'partner.revoked')">
          {{ t('partner.revoke') }}
        </AppUiButton>
      </div>
    </template>

    <!-- Pas encore de binôme : invitation -->
    <AppUiCard v-else :title="t('partner.inviteTitle')">
      <div class="space-y-4 text-sm">
        <p class="text-app-secondary">{{ t('partner.inviteExplain') }}</p>
        <p class="text-app-secondary">{{ t('partner.privacy') }}</p>

        <div v-if="inviteLink" class="space-y-2">
          <label for="invite-link" class="text-sm font-semibold text-app-ink">{{ t('partner.linkLabel') }}</label>
          <div class="flex gap-2">
            <input id="invite-link" :value="inviteLink" readonly class="app-input flex-1" @focus="($event.target as HTMLInputElement).select()">
            <AppUiButton variant="secondary" @click="copyLink">{{ t('partner.copy') }}</AppUiButton>
          </div>
          <p class="text-xs text-app-secondary">{{ t('partner.linkHint') }}</p>
        </div>
        <p v-else-if="data?.invitation" class="text-app-secondary">{{ t('partner.pendingInvite') }}</p>

        <div class="flex flex-wrap gap-3">
          <AppUiButton :loading="busy" @click="createInvite">
            {{ data?.invitation || inviteLink ? t('partner.newLink') : t('partner.createLink') }}
          </AppUiButton>
          <AppUiButton v-if="data?.invitation" variant="ghost" :disabled="busy" @click="revoke(data.invitation.id, 'partner.inviteCancelled')">
            {{ t('partner.cancelInvite') }}
          </AppUiButton>
        </div>
      </div>
    </AppUiCard>

    <div class="mt-6">
      <p v-if="feedback" role="status" class="text-sm text-emerald-600">{{ feedback }}</p>
      <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
    </div>
  </div>
</template>
