<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const { login } = useAuth()

const oauthErrors: Record<string, string> = {
  google_denied: 'Connexion Google annulée',
  google_blocked: 'Ce compte est suspendu',
  google_email_unverified: 'Votre email Google n\'est pas vérifié',
  google_failed: 'Échec de la connexion Google. Réessayez.',
}

onMounted(() => {
  const oauthError = route.query.error as string | undefined
  if (oauthError && oauthErrors[oauthError]) {
    error.value = oauthErrors[oauthError]
  }
})

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    const user = await login(email.value, password.value)
    await navigateTo(user.role === 'admin' ? '/admin' : '/app')
  } catch (e: any) {
    error.value = e?.data?.message ?? 'Erreur de connexion'
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
      <h1 class="focus-heading-lg text-center">Connexion</h1>
      <p class="focus-body mt-2 text-center">Accédez à votre espace Focus</p>

      <div class="mt-8">
        <GoogleAuthButton />
      </div>

      <div class="relative my-6">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-focus-gray-200" />
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="bg-white px-3 text-focus-gray-400">ou</span>
        </div>
      </div>

      <form class="space-y-5" @submit.prevent="handleLogin">
        <UiInput v-model="email" label="Email" type="email" required placeholder="vous@email.com" />
        <UiInput v-model="password" label="Mot de passe" type="password" required placeholder="••••••••" />
        <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
        <UiButton type="submit" class="w-full" :loading="loading">Se connecter</UiButton>
      </form>

      <div class="mt-6 text-center text-sm text-focus-gray-400">
        <NuxtLink to="/mot-de-passe-oublie" class="hover:text-focus-gray-700">Mot de passe oublié ?</NuxtLink>
        <span class="mx-2">·</span>
        <NuxtLink to="/inscription" class="hover:text-focus-gray-700">Créer un compte</NuxtLink>
      </div>
    </div>
  </div>
</template>
