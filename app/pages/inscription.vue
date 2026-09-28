<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const email = ref('')
const password = ref('')
const displayName = ref('')
const error = ref('')
const loading = ref(false)
const { register } = useAuth()
const { t } = useI18n()
const authErrorMessage = useAuthErrorMessage()

async function handleRegister() {
  error.value = ''
  loading.value = true
  try {
    await register(email.value, password.value, displayName.value)
    const redirect = safeRedirect(route.query.redirect)
    await navigateTo({ path: '/app/onboarding', query: redirect ? { redirect } : {} })
  } catch (e: any) {
    error.value = authErrorMessage(e, 'auth.errors.register')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100dvh-8rem)] items-center justify-center py-12">
    <div class="w-full max-w-md px-5">
      <div class="mb-8 flex justify-center">
        <AppLogo to="/" size="lg" />
      </div>
      <h1 class="focus-heading-lg text-center">{{ t('auth.register.title') }}</h1>
      <p class="focus-body mt-2 text-center">{{ t('auth.register.subtitle') }}</p>

      <div class="mt-8">
        <GoogleAuthButton />
      </div>

      <div class="relative my-6">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-focus-gray-200" />
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="bg-white px-3 text-focus-gray-400">{{ t('common.or') }}</span>
        </div>
      </div>

      <form class="space-y-5" @submit.prevent="handleRegister">
        <UiInput v-model="displayName" :label="t('auth.register.displayNameLabel')" required :placeholder="t('auth.register.displayNamePlaceholder')" />
        <UiInput v-model="email" :label="t('auth.emailLabel')" type="email" required :placeholder="t('auth.emailPlaceholder')" />
        <UiInput v-model="password" :label="t('auth.passwordLabel')" type="password" required :placeholder="t('auth.register.passwordPlaceholder')" />
        <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
        <UiButton type="submit" class="w-full" :loading="loading">{{ t('auth.register.submit') }}</UiButton>
      </form>

      <p class="mt-6 text-center text-sm text-focus-gray-400">
        {{ t('auth.register.alreadyRegistered') }}
        <NuxtLink :to="{ path: '/connexion', query: route.query.redirect ? { redirect: route.query.redirect } : {} }" class="text-focus-gray-700 hover:underline">{{ t('auth.register.login') }}</NuxtLink>
      </p>
    </div>
  </div>
</template>
