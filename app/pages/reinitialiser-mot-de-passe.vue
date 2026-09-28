<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref(false)
const loading = ref(false)
const { t } = useI18n()

async function handleReset() {
  if (password.value !== confirmPassword.value) {
    error.value = t('auth.errors.passwordMismatch')
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
    error.value = e?.statusCode === 400 ? t('auth.errors.invalidResetLink') : e?.data?.message ?? t('common.error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100dvh-8rem)] items-center justify-center py-12">
    <div class="w-full max-w-md px-5">
      <h1 class="focus-heading-lg text-center">{{ t('auth.reset.title') }}</h1>
      <div v-if="success" class="mt-8 text-center">
        <p class="focus-body">{{ t('auth.reset.success') }}</p>
        <NuxtLink to="/connexion" class="focus-btn-primary mt-6 inline-flex">{{ t('auth.reset.login') }}</NuxtLink>
      </div>
      <form v-else class="mt-8 space-y-5" @submit.prevent="handleReset">
        <UiInput v-model="password" :label="t('auth.reset.newPassword')" type="password" required />
        <UiInput v-model="confirmPassword" :label="t('auth.reset.confirm')" type="password" required />
        <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
        <UiButton type="submit" class="w-full" :loading="loading">{{ t('auth.reset.submit') }}</UiButton>
      </form>
    </div>
  </div>
</template>
