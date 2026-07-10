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
  <div class="flex min-h-[60dvh] items-center justify-center p-5">
    <div class="w-full max-w-md">
      <div class="mb-8 flex justify-center">
        <AppLogo to="/app" size="lg" />
      </div>
      <h1 class="focus-heading-lg text-center">Bienvenue sur Focus</h1>
      <p class="focus-body mt-2 text-center">Configurez votre profil pour commencer.</p>

      <form class="mt-8 space-y-5" @submit.prevent="handleSubmit">
        <UiInput v-model="displayName" label="Nom d'affichage" required />
        <UiTimezoneSelect v-model="timezone" label="Fuseau horaire" required />
        <label class="flex items-center gap-3">
          <input v-model="leaderboardOptIn" type="checkbox" class="h-4 w-4 rounded border-focus-gray-300">
          <span class="text-sm text-focus-gray-600">Participer au classement</span>
        </label>
        <UiButton type="submit" class="w-full" :loading="loading">Continuer</UiButton>
      </form>
    </div>
  </div>
</template>
