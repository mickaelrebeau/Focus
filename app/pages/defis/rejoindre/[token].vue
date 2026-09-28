<script setup lang="ts">
definePageMeta({ layout: 'default' })

interface Invitation {
  id: string
  name: string
  creatorName: string
  metric: 'perfect_days' | 'completed_occurrences'
  weekStart: string
  weekEnd: string
  stakeCredits: number
  participants: number
  maxParticipants: number
  closed: boolean
}

const route = useRoute()
const token = String(route.params.token)
const { t } = useI18n()
const { isAuthenticated, fetchUser } = useAuth()

const { data } = await useFetch<Invitation>(`/api/challenges/invitations/${token}`)

const joining = ref(false)
const error = ref('')
const returnTo = computed(() => ({ redirect: route.fullPath }))

async function join() {
  error.value = ''
  joining.value = true
  try {
    const { id } = await $fetch<{ id: string }>(`/api/challenges/invitations/${token}/join`, { method: 'POST', credentials: 'include' })
    await fetchUser()
    await navigateTo(`/app/defis/${id}`)
  } catch (err: unknown) {
    const code = (err as { data?: { data?: { code?: string } } })?.data?.data?.code
    // Déjà inscrit : direction le défi
    if (code === 'already_joined' && data.value) return navigateTo(`/app/defis/${data.value.id}`)
    error.value = code ? t(`challenges.errors.${code}`) : t('challenges.errors.generic')
  } finally {
    joining.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100dvh-8rem)] items-center justify-center py-12">
    <div class="w-full max-w-md px-5 text-center">
      <div class="mb-8 flex justify-center">
        <AppLogo to="/" size="lg" />
      </div>

      <template v-if="data && !data.closed">
        <h1 class="focus-heading-lg">{{ t('challenges.invite.title', { name: data.creatorName, challenge: data.name }) }}</h1>
        <p class="focus-body mt-3">
          {{ t('challenges.invite.explain', { metric: t(`challenges.metrics.${data.metric}`) }) }}
        </p>
        <p class="mt-3 text-sm text-focus-gray-400">
          {{ data.stakeCredits > 0 ? t('challenges.invite.stake', { n: data.stakeCredits }) : t('challenges.invite.noStake') }}
          {{ t('challenges.invite.slots', { count: data.participants, max: data.maxParticipants }) }}
        </p>

        <div class="mt-8 space-y-3">
          <UiButton v-if="isAuthenticated" class="w-full" :loading="joining" @click="join">
            {{ data.stakeCredits > 0 ? t('challenges.invite.joinWithStake', { n: data.stakeCredits }) : t('challenges.invite.join') }}
          </UiButton>
          <template v-else>
            <NuxtLink :to="{ path: '/connexion', query: returnTo }" class="focus-btn-primary flex w-full justify-center">
              {{ t('challenges.invite.loginToJoin') }}
            </NuxtLink>
            <NuxtLink :to="{ path: '/inscription', query: returnTo }" class="focus-btn-secondary flex w-full justify-center">
              {{ t('challenges.invite.signupToJoin') }}
            </NuxtLink>
          </template>
        </div>
        <p v-if="error" role="alert" class="mt-4 text-sm text-red-500">{{ error }}</p>
      </template>

      <template v-else>
        <h1 class="focus-heading-lg">{{ t('challenges.invite.unavailableTitle') }}</h1>
        <p class="focus-body mt-3">{{ data?.closed ? t('challenges.errors.closed') : t('challenges.errors.invalid_invite') }}</p>
      </template>
    </div>
  </div>
</template>
