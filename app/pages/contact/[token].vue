<script setup lang="ts">
// Page du contact de confiance (sans compte) : second opt-in, et désinscription à tout moment
definePageMeta({ layout: 'default' })

interface ContactInvitation {
  userName: string
  contactName: string | null
  status: 'pending' | 'confirmed' | 'declined'
}

const route = useRoute()
const token = String(route.params.token)
const { t } = useI18n()

useSeoMeta({ robots: 'noindex, nofollow' })

const { data, error: loadError } = await useFetch<ContactInvitation>(`/api/accountability/contacts/${token}`)
if (loadError.value) {
  const event = useRequestEvent()
  if (event) setResponseStatus(event, 404)
}

const saving = ref(false)
const error = ref('')
const answered = ref(false)

async function answer(accept: boolean) {
  error.value = ''
  saving.value = true
  try {
    const result = await $fetch<{ status: ContactInvitation['status'] }>(`/api/accountability/contacts/${token}/consent`, {
      method: 'POST',
      body: { accept },
    })
    data.value = { ...data.value!, status: result.status }
    answered.value = true
  } catch {
    error.value = t('accountability.page.error')
  } finally {
    saving.value = false
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
        <h1 class="focus-heading-lg">{{ t('accountability.page.title', { name: data.userName }) }}</h1>
        <p class="focus-body mt-3">{{ t('accountability.page.intro', { name: data.userName }) }}</p>

        <p v-if="answered || data.status !== 'pending'" role="status" class="mt-6 rounded-lg bg-focus-gray-50 px-4 py-3 text-sm text-focus-gray-700">
          {{ data.status === 'confirmed'
            ? t('accountability.page.confirmed', { name: data.userName })
            : data.status === 'declined' ? t('accountability.page.declined', { name: data.userName }) : '' }}
        </p>

        <div class="mt-8 flex flex-col gap-3">
          <template v-if="data.status === 'pending'">
            <UiButton :loading="saving" @click="answer(true)">{{ t('accountability.page.accept') }}</UiButton>
            <UiButton variant="secondary" :disabled="saving" @click="answer(false)">{{ t('accountability.page.decline') }}</UiButton>
          </template>
          <UiButton v-else-if="data.status === 'confirmed'" variant="secondary" :loading="saving" @click="answer(false)">
            {{ t('accountability.page.stop') }}
          </UiButton>
          <UiButton v-else variant="secondary" :loading="saving" @click="answer(true)">
            {{ t('accountability.page.resume') }}
          </UiButton>
        </div>
        <p v-if="error" class="mt-3 text-sm text-red-500">{{ error }}</p>
      </template>

      <template v-else>
        <h1 class="focus-heading-lg">{{ t('accountability.page.notFoundTitle') }}</h1>
        <p class="focus-body mt-3">{{ t('accountability.page.notFound') }}</p>
      </template>
    </div>
  </div>
</template>
