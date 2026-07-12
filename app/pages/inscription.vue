<script setup lang="ts">
definePageMeta({ layout: 'default' })

const email = ref('')
const password = ref('')
const displayName = ref('')
const error = ref('')
const loading = ref(false)
const { register } = useAuth()

async function handleRegister() {
  error.value = ''
  loading.value = true
  try {
    await register(email.value, password.value, displayName.value)
    await navigateTo('/app/onboarding')
  } catch (e: any) {
    error.value = e?.data?.message ?? 'Erreur lors de l\'inscription'
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
      <h1 class="focus-heading-lg text-center">Créer un compte</h1>
      <p class="focus-body mt-2 text-center">Commencez avec 50 crédits offerts</p>

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

      <form class="space-y-5" @submit.prevent="handleRegister">
        <UiInput v-model="displayName" label="Nom d'affichage" required placeholder="Votre prénom" />
        <UiInput v-model="email" label="Email" type="email" required placeholder="vous@email.com" />
        <UiInput v-model="password" label="Mot de passe" type="password" required placeholder="8 caractères minimum" />
        <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
        <UiButton type="submit" class="w-full" :loading="loading">S'inscrire</UiButton>
      </form>

      <p class="mt-6 text-center text-sm text-focus-gray-400">
        Déjà un compte ?
        <NuxtLink to="/connexion" class="text-focus-gray-700 hover:underline">Se connecter</NuxtLink>
      </p>
    </div>
  </div>
</template>
