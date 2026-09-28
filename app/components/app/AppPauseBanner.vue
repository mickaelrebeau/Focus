<script setup lang="ts">
import { format, parseISO } from 'date-fns'

const { user } = useAuth()
const { t } = useI18n()
const { dateLocale } = useLanguage()

const endLabel = computed(() => {
  const pause = user.value?.activePause
  return pause ? format(parseISO(pause.endDate), 'EEEE d MMMM', { locale: dateLocale.value }) : ''
})
</script>

<template>
  <div
    v-if="user?.activePause"
    role="status"
    class="border-b border-sky-200 bg-sky-50 px-4 py-2.5 text-center text-sm text-sky-900"
  >
    <span class="font-semibold">{{ t('pause.bannerTitle') }}</span>
    {{ t('pause.bannerText', { date: endLabel }) }}
    <NuxtLink to="/app/reglages/pause" class="ml-1 font-semibold underline underline-offset-2">
      {{ t('pause.bannerLink') }}
    </NuxtLink>
  </div>
</template>
