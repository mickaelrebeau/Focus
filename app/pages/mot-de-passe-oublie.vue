<script setup lang="ts">
definePageMeta({ layout: 'default' })

const email = ref('')
const message = ref('')
const loading = ref(false)

async function handleSubmit() {
  loading.value = true
  try {
    const data = await $fetch<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: email.value },
    })
    message.value = data.message
  } catch {
    message.value = 'Une erreur est survenue.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100dvh-8rem)] items-center justify-center py-12">
    <div class="w-full max-w-md px-5">
      <h1 class="focus-heading-lg text-center">Mot de passe oublié</h1>
      <form v-if="!message" class="mt-8 space-y-5" @submit.prevent="handleSubmit">
        <UiInput v-model="email" label="Email" type="email" required />
        <UiButton type="submit" class="w-full" :loading="loading">Envoyer le lien</UiButton>
      </form>
      <p v-else class="focus-body mt-8 text-center">{{ message }}</p>
    </div>
  </div>
</template>
