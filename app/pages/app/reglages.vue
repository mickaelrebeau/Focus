<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })

import { DEFAULT_TIMEZONE, isValidTimezone } from '#shared/timezones'

const { user, fetchUser, logout, isAdmin } = useAuth()
const displayName = ref('')
const timezone = ref(DEFAULT_TIMEZONE)
const leaderboardOptIn = ref(true)
const loading = ref(false)

onMounted(() => {
  if (user.value) {
    displayName.value = user.value.displayName
    timezone.value = user.value.timezone && isValidTimezone(user.value.timezone)
      ? user.value.timezone
      : DEFAULT_TIMEZONE
    leaderboardOptIn.value = user.value.leaderboardOptIn ?? true
  }
})

async function save() {
  loading.value = true
  await $fetch('/api/user/settings', {
    method: 'PATCH',
    body: { displayName: displayName.value, timezone: timezone.value, leaderboardOptIn: leaderboardOptIn.value },
  })
  await fetchUser()
  loading.value = false
}
</script>

<template>
  <div class="p-5 md:p-8">
    <h1 class="focus-heading-lg">Réglages</h1>

    <form class="mt-8 max-w-lg space-y-5" @submit.prevent="save">
      <UiInput v-model="displayName" label="Nom d'affichage" />
      <UiTimezoneSelect v-model="timezone" label="Fuseau horaire" />
      <label class="flex items-center gap-3">
        <input v-model="leaderboardOptIn" type="checkbox" class="h-4 w-4 rounded">
        <span class="text-sm">Participer au classement</span>
      </label>
      <UiButton type="submit" :loading="loading">Enregistrer</UiButton>
    </form>

    <div class="mt-12 space-y-3">
      <NuxtLink
        v-if="isAdmin"
        to="/admin"
        class="focus-btn-secondary inline-flex"
      >
        ◆ Administration
      </NuxtLink>
      <div>
        <UiButton variant="ghost" class="text-red-500" @click="logout">Déconnexion</UiButton>
      </div>
    </div>
  </div>
</template>
