<script setup lang="ts">
import { shareCardBlob, type ShareCardContent } from '~/utils/share-card'

definePageMeta({ layout: 'default' })

interface PublicProfile {
  displayName: string
  currentStreak: number
  longestStreak: number
  badges: Array<{ days: number, reached: boolean }>
}

const route = useRoute()
const slug = String(route.params.slug)
const { t } = useI18n()
const { user } = useAuth()
const config = useRuntimeConfig()

const { data: profile } = await useFetch<PublicProfile>(`/api/public/profiles/${slug}`)
if (!profile.value) {
  const event = useRequestEvent()
  if (event) setResponseStatus(event, 404)
}

const isOwner = computed(() => user.value?.publicSlug === slug)
const pageUrl = computed(() => `${config.public.appUrl}/u/${slug}`)
const headline = computed(() => profile.value && profile.value.currentStreak > 0
  ? t('publicProfile.days', profile.value.currentStreak)
  : t('publicProfile.noStreak'))
const subline = computed(() => profile.value ? t('publicProfile.record', profile.value.longestStreak) : '')

useSeoMeta({
  title: () => profile.value ? `${profile.value.displayName} · ${headline.value}` : t('publicProfile.notFoundTitle'),
  ogTitle: () => profile.value ? `${profile.value.displayName} · ${headline.value}` : 'Focus',
  description: () => subline.value,
  ogDescription: () => subline.value,
  ogImage: `${config.public.appUrl}/logo.png`,
  twitterCard: 'summary',
  // Partager un lien n'est pas demander à être indexé par les moteurs de recherche
  robots: 'noindex, nofollow',
})

const feedback = ref('')
const busy = ref(false)

function cardContent(): ShareCardContent {
  return {
    headline: headline.value,
    subline: subline.value,
    name: profile.value!.displayName,
    badges: profile.value!.badges.map(badge => ({ label: t('publicProfile.badge', { days: badge.days }), reached: badge.reached })),
    footer: pageUrl.value.replace(/^https?:\/\//, ''),
  }
}

function imageName() {
  return `focus-${slug}.png`
}

// Mobile : feuille de partage native avec l'image si possible, sinon le lien ; ailleurs, copie du lien
async function share() {
  feedback.value = ''
  busy.value = true
  try {
    const shareData: ShareData = { title: headline.value, text: `${headline.value} · ${subline.value}`, url: pageUrl.value }
    if (navigator.share) {
      const file = new File([await shareCardBlob(cardContent())], imageName(), { type: 'image/png' })
      await navigator.share(navigator.canShare?.({ files: [file] }) ? { ...shareData, files: [file] } : shareData)
      return
    }
    await copyLink()
  } catch {
    // Partage annulé : rien à signaler
  } finally {
    busy.value = false
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(pageUrl.value)
    feedback.value = t('publicProfile.copied')
  } catch {
    feedback.value = pageUrl.value
  }
}

async function downloadImage() {
  busy.value = true
  try {
    const url = URL.createObjectURL(await shareCardBlob(cardContent()))
    const link = document.createElement('a')
    link.href = url
    link.download = imageName()
    link.click()
    URL.revokeObjectURL(url)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100dvh-8rem)] items-center justify-center py-10">
    <div class="w-full max-w-3xl px-4 sm:px-5">
      <div class="mb-8 flex justify-center">
        <AppLogo to="/" size="lg" />
      </div>

      <div v-if="!profile" class="mx-auto max-w-md text-center">
        <h1 class="focus-heading-lg">{{ t('publicProfile.notFoundTitle') }}</h1>
        <p class="focus-body mt-3">{{ t('publicProfile.notFound') }}</p>
        <NuxtLink to="/" class="app-button-primary mt-8 inline-flex">{{ t('publicProfile.discover') }}</NuxtLink>
      </div>

      <div v-else class="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_16rem]">
        <!-- Même contenu que l'image partagée, en HTML pour la page -->
        <article
          class="aspect-square w-full overflow-hidden rounded-app-card border border-app-line bg-app-canvas p-7 shadow-app-soft sm:p-10"
          data-testid="share-card"
        >
          <div class="flex h-full flex-col">
            <div class="-mx-7 -mt-7 mb-7 h-1.5 bg-app-ink sm:-mx-10 sm:-mt-10 sm:mb-10" />
            <p class="truncate text-base font-semibold text-app-muted sm:text-lg">{{ profile.displayName }}</p>
            <h1 class="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-app-ink sm:text-6xl">{{ headline }}</h1>
            <p class="mt-4 text-base text-app-muted sm:text-xl">{{ subline }}</p>
            <ul class="mt-auto grid grid-cols-4 gap-2 sm:gap-3" :aria-label="t('publicProfile.badgesLabel')">
              <li
                v-for="badge in profile.badges"
                :key="badge.days"
                class="flex h-11 items-center justify-center rounded-full text-sm font-bold sm:h-14 sm:text-base"
                :class="badge.reached ? 'bg-app-ink text-white' : 'text-app-muted ring-2 ring-inset ring-app-line'"
                :aria-label="badge.reached ? t('publicProfile.badgeReached', { days: badge.days }) : t('publicProfile.badgeLocked', { days: badge.days })"
              >
                {{ t('publicProfile.badge', { days: badge.days }) }}
              </li>
            </ul>
            <p class="mt-6 text-lg font-extrabold text-app-ink sm:mt-8 sm:text-2xl">Focus</p>
          </div>
        </article>

        <div class="space-y-3">
          <AppUiButton class="w-full" :loading="busy" @click="share">{{ t('publicProfile.share') }}</AppUiButton>
          <AppUiButton variant="secondary" class="w-full" @click="copyLink">{{ t('publicProfile.copyLink') }}</AppUiButton>
          <AppUiButton variant="secondary" class="w-full" :disabled="busy" @click="downloadImage">{{ t('publicProfile.download') }}</AppUiButton>
          <p v-if="feedback" role="status" class="break-all text-center text-sm text-app-secondary">{{ feedback }}</p>
          <NuxtLink v-if="isOwner" to="/app/reglages#profil-public" class="block pt-2 text-center text-sm font-semibold text-app-ink underline underline-offset-2">
            {{ t('publicProfile.manage') }}
          </NuxtLink>
          <NuxtLink v-else to="/inscription" class="block pt-2 text-center text-sm font-semibold text-app-ink underline underline-offset-2">
            {{ t('publicProfile.join') }}
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
