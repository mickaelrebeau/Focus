<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref(false)
const loading = ref(false)

async function handleReset() {
  if (password.value !== confirmPassword.value) {
    error.value = 'Les mots de passe ne correspondent pas'
    return
  }
  loading.value = true
  try {
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: { token: route.query.token, password: password.value },
    })
    success.value = true
  } catch (e: any) {
    error.value = e?.data?.message ?? 'Erreur'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100dvh-8rem)] items-center justify-center py-12">
    <div class="w-full max-w-md px-5">
      <h1 class="focus-heading-lg text-center">Nouveau mot de passe</h1>
      <div v-if="success" class="mt-8 text-center">
        <p class="focus-body">Mot de passe mis à jour.</p>
        <NuxtLink to="/connexion" class="focus-btn-primary mt-6 inline-flex">Se connecter</NuxtLink>
      </div>
      <form v-else class="mt-8 space-y-5" @submit.prevent="handleReset">
        <UiInput v-model="password" label="Nouveau mot de passe" type="password" required />
        <UiInput v-model="confirmPassword" label="Confirmer" type="password" required />
        <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
        <UiButton type="submit" class="w-full" :loading="loading">Réinitialiser</UiButton>
      </form>
    </div>
  </div>
</template>
