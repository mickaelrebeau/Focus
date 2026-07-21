<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })

import { DEFAULT_TIMEZONE, isValidTimezone } from '#shared/timezones'

const displayName = ref('')
const timezone = ref(DEFAULT_TIMEZONE)
const leaderboardOptIn = ref(true)
const loading = ref(false)
const { user, fetchUser } = useAuth()

onMounted(() => {
  if (user.value) {
    displayName.value = user.value.displayName
    timezone.value = user.value.timezone && isValidTimezone(user.value.timezone)
      ? user.value.timezone
      : DEFAULT_TIMEZONE
    leaderboardOptIn.value = user.value.leaderboardOptIn ?? true
  }
})

async function handleSubmit() {
  loading.value = true
  await $fetch('/api/user/settings', {
    method: 'PATCH',
    body: {
      displayName: displayName.value,
      timezone: timezone.value,
      leaderboardOptIn: leaderboardOptIn.value,
    },
  })
  await fetchUser()
  await navigateTo('/app')
  loading.value = false
}
</script>

<template>
  <div class="app-page flex min-h-[70dvh] items-center justify-center">
    <div class="app-sheet w-full max-w-md p-6 sm:p-8">
      <div class="mb-7 flex justify-center">
        <AppLogo to="/app" size="lg" />
      </div>
      <p class="app-eyebrow text-center">Premiers pas</p>
      <h1 class="app-heading mt-1 text-center">Bienvenue sur Focus</h1>
      <p class="mt-2 text-center text-sm text-app-secondary">Configurez votre profil pour commencer.</p>

      <form class="mt-8 space-y-5" @submit.prevent="handleSubmit">
        <AppUiInput v-model="displayName" label="Nom d'affichage" required />
        <AppUiTimezoneSelect v-model="timezone" label="Fuseau horaire" required />
        <AppUiToggle
          v-model="leaderboardOptIn"
          label="Participer au classement"
          description="Votre score net pourra apparaître dans le classement."
        />
        <AppUiButton type="submit" class="w-full" :loading="loading">Continuer</AppUiButton>
      </form>
    </div>
  </div>
</template>
