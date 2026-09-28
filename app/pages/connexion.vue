<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const { login } = useAuth()
const { t } = useI18n()
const authErrorMessage = useAuthErrorMessage()

const oauthErrors: Record<string, string> = {
  google_denied: 'auth.errors.googleDenied',
  google_blocked: 'auth.errors.googleBlocked',
  google_email_unverified: 'auth.errors.googleEmailUnverified',
  google_failed: 'auth.errors.googleFailed',
}

onMounted(() => {
  const oauthError = route.query.error as string | undefined
  if (oauthError && oauthErrors[oauthError]) {
    error.value = t(oauthErrors[oauthError])
  }
})

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    const user = await login(email.value, password.value)
    await navigateTo(safeRedirect(route.query.redirect) ?? (user.role === 'admin' ? '/admin' : '/app'))
  } catch (e: any) {
    error.value = authErrorMessage(e, 'auth.errors.login')
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
      <h1 class="focus-heading-lg text-center">{{ t('auth.login.title') }}</h1>
      <p class="focus-body mt-2 text-center">{{ t('auth.login.subtitle') }}</p>

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

      <form class="space-y-5" @submit.prevent="handleLogin">
        <UiInput v-model="email" :label="t('auth.emailLabel')" type="email" required :placeholder="t('auth.emailPlaceholder')" />
        <UiInput v-model="password" :label="t('auth.passwordLabel')" type="password" required placeholder="••••••••" />
        <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
        <UiButton type="submit" class="w-full" :loading="loading">{{ t('auth.login.submit') }}</UiButton>
      </form>

      <div class="mt-6 text-center text-sm text-focus-gray-400">
        <NuxtLink to="/mot-de-passe-oublie" class="hover:text-focus-gray-700">{{ t('auth.login.forgotPassword') }}</NuxtLink>
        <span class="mx-2">·</span>
        <NuxtLink :to="{ path: '/inscription', query: route.query.redirect ? { redirect: route.query.redirect } : {} }" class="hover:text-focus-gray-700">{{ t('auth.login.createAccount') }}</NuxtLink>
      </div>
    </div>
  </div>
</template>
