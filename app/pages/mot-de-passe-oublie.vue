<script setup lang="ts">
definePageMeta({ layout: 'default' })

const email = ref('')
const message = ref('')
const loading = ref(false)
const { t } = useI18n()

async function handleSubmit() {
  loading.value = true
  try {
    await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: email.value },
    })
    // Réponse volontairement générique : le serveur ne révèle pas si l'email existe
    message.value = t('auth.forgot.sent')
  } catch {
    message.value = t('auth.errors.generic')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100dvh-8rem)] items-center justify-center py-12">
    <div class="w-full max-w-md px-5">
      <h1 class="focus-heading-lg text-center">{{ t('auth.forgot.title') }}</h1>
      <form v-if="!message" class="mt-8 space-y-5" @submit.prevent="handleSubmit">
        <UiInput v-model="email" :label="t('auth.emailLabel')" type="email" required />
        <UiButton type="submit" class="w-full" :loading="loading">{{ t('auth.forgot.submit') }}</UiButton>
      </form>
      <p v-else class="focus-body mt-8 text-center">{{ message }}</p>
    </div>
  </div>
</template>
