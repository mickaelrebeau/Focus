<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const token = String(route.params.token)
const { t } = useI18n()
const { isAuthenticated } = useAuth()

const { data, error: loadError } = await useFetch<{ inviterName: string }>(`/api/partnerships/invitations/${token}`)

const accepting = ref(false)
const error = ref('')

const loadErrorCode = computed(() => (loadError.value?.data as { data?: { code?: string } } | undefined)?.data?.code)
const returnTo = computed(() => ({ redirect: route.fullPath }))

async function accept() {
  error.value = ''
  accepting.value = true
  try {
    await $fetch(`/api/partnerships/invitations/${token}/accept`, { method: 'POST', credentials: 'include' })
    await navigateTo('/app/binome')
  } catch (err: unknown) {
    const code = (err as { data?: { data?: { code?: string } } })?.data?.data?.code
    error.value = code ? t(`partner.errors.${code}`) : t('partner.errors.generic')
  } finally {
    accepting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100dvh-8rem)] items-center justify-center py-12">
    <div class="w-full max-w-md px-5 text-center">
      <div class="mb-8 flex justify-center">
        <AppLogo to="/" size="lg" />
      </div>

      <template v-if="data">
        <h1 class="focus-heading-lg">{{ t('partner.invite.title', { name: data.inviterName }) }}</h1>
        <p class="focus-body mt-3">{{ t('partner.invite.explain') }}</p>
        <p class="mt-3 text-sm text-focus-gray-400">{{ t('partner.invite.privacy') }}</p>

        <div class="mt-8 space-y-3">
          <UiButton v-if="isAuthenticated" class="w-full" :loading="accepting" @click="accept">
            {{ t('partner.invite.accept') }}
          </UiButton>
          <template v-else>
            <NuxtLink :to="{ path: '/connexion', query: returnTo }" class="focus-btn-primary flex w-full justify-center">
              {{ t('partner.invite.loginToAccept') }}
            </NuxtLink>
            <NuxtLink :to="{ path: '/inscription', query: returnTo }" class="focus-btn-secondary flex w-full justify-center">
              {{ t('partner.invite.signupToAccept') }}
            </NuxtLink>
          </template>
        </div>
        <p v-if="error" role="alert" class="mt-4 text-sm text-red-500">{{ error }}</p>
      </template>

      <template v-else>
        <h1 class="focus-heading-lg">{{ t('partner.invite.unavailableTitle') }}</h1>
        <p class="focus-body mt-3">
          {{ loadErrorCode === 'expired' ? t('partner.errors.expired') : t('partner.errors.invalid_invite') }}
        </p>
      </template>
    </div>
  </div>
</template>
