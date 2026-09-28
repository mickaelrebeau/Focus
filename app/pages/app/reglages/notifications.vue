<script setup lang="ts">
import type { NotificationPreferences } from '~/composables/usePushNotifications'

definePageMeta({ layout: 'app', middleware: 'auth' })

const { t } = useI18n()
const {
  support,
  permission,
  subscribed,
  status,
  busy,
  serverConfigured,
  refresh,
  enable,
  disable,
  updatePreferences,
  sendTest,
} = usePushNotifications()

const loading = ref(true)
const feedback = ref('')
const error = ref('')

const minuteChoices = [15, 30, 60, 120, 240] as const
const preferenceToggles = [
  { key: 'dueReminder', label: 'notifications.types.dueReminder', description: 'notifications.types.dueReminderHint' },
  { key: 'streakAtRisk', label: 'notifications.types.streakAtRisk', description: 'notifications.types.streakAtRiskHint' },
  { key: 'consequenceExecuted', label: 'notifications.types.consequenceExecuted', description: 'notifications.types.consequenceExecutedHint' },
  { key: 'milestoneBonus', label: 'notifications.types.milestoneBonus', description: 'notifications.types.milestoneBonusHint' },
] as const

const preferences = computed(() => status.value?.preferences)
const canEnable = computed(() => support.value === 'supported' && serverConfigured.value && permission.value !== 'denied')

onMounted(async () => {
  try {
    await refresh()
  } catch {
    error.value = t('notifications.errors.load')
  } finally {
    loading.value = false
  }
})

async function run(action: () => Promise<unknown>, successKey?: string) {
  error.value = ''
  feedback.value = ''
  try {
    await action()
    if (successKey) feedback.value = t(successKey)
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string }, message?: string }
    error.value = fetchError?.data?.message ?? t('notifications.errors.generic')
  }
}

function setPreference(key: keyof NotificationPreferences, value: boolean | number) {
  return run(() => updatePreferences({ [key]: value }), 'notifications.saved')
}

async function onEnable() {
  await run(enable)
  if (permission.value === 'granted' && subscribed.value) feedback.value = t('notifications.enabled')
}

async function onTest() {
  await run(async () => {
    const result = await sendTest()
    feedback.value = result.sent > 0 ? t('notifications.testSent') : t('notifications.testNotDelivered')
  })
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
      <p class="app-eyebrow">{{ t('notifications.eyebrow') }}</p>
      <h1 class="app-heading mt-1">{{ t('notifications.title') }}</h1>
      <p class="mt-1 text-sm text-app-secondary">{{ t('notifications.subtitle') }}</p>
    </div>

    <div v-if="loading" class="py-12 text-center text-sm text-app-secondary">
      {{ t('common.loading') }}
    </div>

    <template v-else>
      <AppUiCard :title="t('notifications.deviceTitle')">
        <div class="space-y-4 text-sm">
          <p v-if="support === 'ios-not-installed'" class="rounded-app-control bg-app-mist px-4 py-3 text-app-secondary">
            {{ t('notifications.iosInstall') }}
          </p>
          <p v-else-if="support === 'unsupported'" class="rounded-app-control bg-app-mist px-4 py-3 text-app-secondary">
            {{ t('notifications.unsupported') }}
          </p>
          <p v-else-if="!serverConfigured" class="rounded-app-control bg-app-mist px-4 py-3 text-app-secondary">
            {{ t('notifications.notConfigured') }}
          </p>
          <p v-else-if="permission === 'denied'" class="rounded-app-control bg-amber-50 px-4 py-3 text-amber-900">
            {{ t('notifications.denied') }}
          </p>

          <template v-if="subscribed">
            <p class="font-semibold text-emerald-700">{{ t('notifications.activeOnDevice') }}</p>
            <div class="flex flex-wrap gap-3">
              <AppUiButton variant="secondary" :loading="busy" @click="onTest">
                {{ t('notifications.sendTest') }}
              </AppUiButton>
              <AppUiButton variant="ghost" class="!text-red-500" :disabled="busy" @click="run(disable, 'notifications.disabled')">
                {{ t('notifications.disable') }}
              </AppUiButton>
            </div>
          </template>
          <template v-else-if="canEnable">
            <p class="text-app-secondary">{{ t('notifications.consent') }}</p>
            <AppUiButton :loading="busy" @click="onEnable">
              {{ t('notifications.enable') }}
            </AppUiButton>
          </template>

          <p v-if="status && status.devices > 0" class="text-xs text-app-secondary">
            {{ t('notifications.devices', status.devices) }}
          </p>
        </div>
      </AppUiCard>

      <AppUiCard v-if="preferences" :title="t('notifications.typesTitle')" class="mt-4">
        <p v-if="!status?.devices" class="mb-4 text-xs text-app-secondary">
          {{ t('notifications.typesInactive') }}
        </p>
        <div class="space-y-4">
          <template v-for="item in preferenceToggles" :key="item.key">
            <AppUiToggle
              :model-value="preferences[item.key]"
              :label="t(item.label)"
              :description="t(item.description)"
              @update:model-value="setPreference(item.key, $event)"
            />
            <AppUiSelect
              v-if="item.key === 'dueReminder' && preferences.dueReminder"
              :model-value="String(preferences.dueReminderMinutes)"
              :label="t('notifications.reminderDelay')"
              @update:model-value="setPreference('dueReminderMinutes', Number($event))"
            >
              <option v-for="minutes in minuteChoices" :key="minutes" :value="String(minutes)">
                {{ minutes < 60 ? t('notifications.minutesBefore', { n: minutes }) : t('notifications.hoursBefore', minutes / 60) }}
              </option>
            </AppUiSelect>
          </template>
        </div>
      </AppUiCard>

      <div class="mt-6 flex flex-wrap items-center gap-3">
        <p v-if="feedback" role="status" class="text-sm text-emerald-600">{{ feedback }}</p>
        <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
      </div>
    </template>
  </div>
</template>
