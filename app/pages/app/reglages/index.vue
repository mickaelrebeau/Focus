<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })

import { DEFAULT_TIMEZONE, getTimezoneLabel, isValidTimezone } from '#shared/timezones'

import StripePaymentSetup from '~/components/consequences/StripePaymentSetup.vue'
import { formatEuroFromCents, useConsequenceStats } from '~/composables/useConsequences'
import type { AppIconName } from '~/types/app-icon'

const { user, fetchUser, logout, isAdmin } = useAuth()
const { isEnabled: userjotEnabled, showFeedback } = useUserjot()
const pwa = usePWA()
const { data: goalsData } = useGoals()
const { data: walletData } = useWalletHistory()
const { data: consequenceStatsData } = useConsequenceStats()

const displayName = ref('')
const timezone = ref(DEFAULT_TIMEZONE)
const leaderboardOptIn = ref(true)
const profileLoading = ref(false)
const passwordLoading = ref(false)
const profileSaved = ref(false)
const passwordSaved = ref(false)
const profileError = ref('')
const passwordError = ref('')

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

const quickLinks: { to: string, label: string, icon: AppIconName }[] = [
  { to: '/app/objectifs', label: 'Mes objectifs', icon: 'goals' },
  { to: '/app/agenda', label: 'Agenda', icon: 'agenda' },
  { to: '/app/historique', label: 'Historique crédits', icon: 'history' },
  { to: '/app/classement', label: 'Classement', icon: 'ranking' },
  { to: '/app/reglages/consequences', label: 'Conséquences', icon: 'bolt' },
]

const walletTypeLabels: Record<string, string> = {
  task_reward: 'Récompense',
  task_penalty: 'Pénalité',
  debt_created: 'Dette créée',
  debt_repayment: 'Remboursement dette',
  admin_adjustment: 'Ajustement admin',
  signup_bonus: 'Bonus inscription',
  streak_bonus: 'Bonus streak',
  leaderboard_reward: 'Bonus classement',
  transfer_received: 'Transfert reçu',
}

const initials = computed(() => {
  const name = user.value?.displayName?.trim() || user.value?.email || '?'
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
})

const timezoneLabel = computed(() => getTimezoneLabel(timezone.value))

const activeGoalsCount = computed(() => goalsData.value?.goals?.length ?? 0)

const recentEntries = computed(() => (walletData.value?.entries ?? []).slice(0, 3))

const consequenceStats = computed(() => consequenceStatsData.value?.stats)

const paymentSaved = ref(false)

async function onPaymentMethodSaved() {
  paymentSaved.value = false
  await fetchUser()
  paymentSaved.value = true
}

function syncFormFromUser() {
  if (!user.value) return
  displayName.value = user.value.displayName
  timezone.value = user.value.timezone && isValidTimezone(user.value.timezone)
    ? user.value.timezone
    : DEFAULT_TIMEZONE
  leaderboardOptIn.value = user.value.leaderboardOptIn ?? true
}

watch(user, syncFormFromUser, { immediate: true })

async function saveProfile() {
  profileError.value = ''
  profileSaved.value = false
  profileLoading.value = true

  try {
    await $fetch('/api/user/settings', {
      method: 'PATCH',
      body: {
        displayName: displayName.value,
        timezone: timezone.value,
        leaderboardOptIn: leaderboardOptIn.value,
      },
      credentials: 'include',
    })
    await fetchUser()
    profileSaved.value = true
  } catch (error: any) {
    profileError.value = error?.data?.message ?? 'Impossible d\'enregistrer les réglages'
  } finally {
    profileLoading.value = false
  }
}

async function installPwa() {
  await pwa?.install()
}

async function changePassword() {
  passwordError.value = ''
  passwordSaved.value = false

  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Les mots de passe ne correspondent pas'
    return
  }

  passwordLoading.value = true

  try {
    const body = user.value?.hasPassword === false
      ? { newPassword: newPassword.value }
      : {
          currentPassword: currentPassword.value,
          newPassword: newPassword.value,
        }

    await $fetch('/api/user/change-password', {
      method: 'POST',
      body,
      credentials: 'include',
    })
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    passwordSaved.value = true
    await fetchUser()
  } catch (error: any) {
    passwordError.value = error?.data?.message ?? 'Impossible de changer le mot de passe'
  } finally {
    passwordLoading.value = false
  }
}
</script>

<template>
  <div class="app-page animate-fade-in">
    <div class="mb-8">
      <p class="app-eyebrow">Votre espace</p>
      <h1 class="app-heading mt-1">Réglages</h1>
      <p class="mt-1 text-sm text-app-secondary">Profil, préférences et sécurité.</p>
    </div>

    <div class="grid gap-3 lg:grid-cols-2">
      <AppUiCard>
        <div class="flex items-center gap-4">
          <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-app-mist text-lg font-semibold text-app-blue">
            {{ initials }}
          </div>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="truncate text-lg font-semibold text-app-ink">
                {{ user?.displayName }}
              </h2>
              <AppUiBadge v-if="isAdmin" variant="neutral">Admin</AppUiBadge>
            </div>
            <p class="truncate text-sm text-app-secondary">{{ user?.email }}</p>
          </div>
        </div>
      </AppUiCard>

      <AppUiCard>
        <p class="app-eyebrow mb-3">Portefeuille</p>
        <div class="grid grid-cols-3 gap-4">
          <div>
            <p class="text-2xl font-semibold text-app-ink">{{ user?.credits ?? 0 }}</p>
            <p class="text-xs text-app-secondary">Crédits</p>
          </div>
          <div>
            <p class="text-2xl font-semibold" :class="user?.debt ? 'text-red-500' : 'text-app-ink'">
              {{ user?.debt ?? 0 }}
            </p>
            <p class="text-xs text-app-secondary">Dette</p>
          </div>
          <div>
            <p class="text-2xl font-semibold text-app-blue">{{ user?.netScore ?? 0 }}</p>
            <p class="text-xs text-app-secondary">Score net</p>
          </div>
        </div>
        <NuxtLink to="/app/historique" class="mt-4 inline-flex text-sm font-semibold text-app-blue">
          Voir l'historique →
        </NuxtLink>
      </AppUiCard>
    </div>

    <AppUiCard v-if="consequenceStats" title="Conséquences" class="mt-4">
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <p class="text-2xl font-semibold text-app-ink">{{ consequenceStats.totalConfigured }}</p>
          <p class="text-xs text-app-secondary">Configurées</p>
        </div>
        <div>
          <p class="text-2xl font-semibold text-app-ink">{{ consequenceStats.totalExecuted }}</p>
          <p class="text-xs text-app-secondary">Exécutées</p>
        </div>
        <div>
          <p class="text-2xl font-semibold text-app-ink">
            {{ formatEuroFromCents(consequenceStats.moneyCommittedCents) }}
          </p>
          <p class="text-xs text-app-secondary">Argent engagé</p>
        </div>
        <div>
          <p class="text-2xl font-semibold text-app-ink">
            {{ formatEuroFromCents(consequenceStats.moneyDonatedCents) }}
          </p>
          <p class="text-xs text-app-secondary">Argent donné</p>
        </div>
        <div>
          <p class="text-2xl font-semibold text-red-500">{{ consequenceStats.creditsLost }}</p>
          <p class="text-xs text-app-secondary">Crédits perdus</p>
        </div>
      </div>
      <NuxtLink
        to="/app/reglages/consequences"
        class="mt-4 inline-flex text-sm font-semibold text-app-blue"
      >
        Configurer les conséquences →
      </NuxtLink>
    </AppUiCard>

    <AppUiCard id="paiement" title="Paiement" class="mt-4">
      <p class="mb-4 text-sm text-app-secondary">
        Enregistrez une carte pour activer les conséquences monétaires (don, Stripe).
      </p>
      <ClientOnly>
        <StripePaymentSetup
          :payment-method-last4="user?.paymentMethodLast4"
          :payment-method-brand="user?.paymentMethodBrand"
          @saved="onPaymentMethodSaved"
        />
      </ClientOnly>
      <p v-if="paymentSaved" class="mt-3 text-sm text-emerald-600">
        Carte enregistrée.
      </p>
    </AppUiCard>

    <form class="mt-4 space-y-4" @submit.prevent="saveProfile">
      <AppUiCard title="Profil">
        <div class="space-y-5">
          <AppUiInput v-model="displayName" label="Nom d'affichage" placeholder="Votre nom public" />
          <AppUiInput :model-value="user?.email ?? ''" label="Email" type="email" disabled />
          <AppUiTimezoneSelect v-model="timezone" label="Fuseau horaire" />
          <p class="text-xs text-app-secondary">
            Les échéances sont calculées selon {{ timezoneLabel }}.
          </p>
        </div>
      </AppUiCard>

      <AppUiCard title="Préférences">
        <div class="space-y-4">
          <AppUiToggle
            v-model="leaderboardOptIn"
            label="Participer au classement"
            description="Votre score net apparaît dans le classement public. Vous pouvez le désactiver à tout moment."
          />
          <div class="rounded-app-control bg-app-canvas px-4 py-3 text-sm text-app-secondary">
            <span class="font-semibold text-app-ink">{{ activeGoalsCount }}</span>
            objectif{{ activeGoalsCount > 1 ? 's' : '' }} actif{{ activeGoalsCount > 1 ? 's' : '' }}
          </div>
        </div>
      </AppUiCard>

      <div class="flex flex-wrap items-center gap-3">
        <AppUiButton type="submit" :loading="profileLoading">Enregistrer les modifications</AppUiButton>
        <p v-if="profileSaved" class="text-sm text-emerald-600">Réglages enregistrés.</p>
        <p v-if="profileError" class="text-sm text-red-500">{{ profileError }}</p>
      </div>
    </form>

    <AppUiCard title="Sécurité" class="mt-4">
      <form class="max-w-lg space-y-5" @submit.prevent="changePassword">
        <p v-if="user?.hasPassword === false" class="text-sm text-app-secondary">
          Votre compte utilise la connexion Google. Vous pouvez définir un mot de passe pour vous connecter aussi par email.
        </p>
        <AppUiInput
          v-if="user?.hasPassword !== false"
          v-model="currentPassword"
          label="Mot de passe actuel"
          type="password"
          autocomplete="current-password"
          placeholder="••••••••"
        />
        <AppUiInput
          v-model="newPassword"
          :label="user?.hasPassword === false ? 'Mot de passe' : 'Nouveau mot de passe'"
          type="password"
          autocomplete="new-password"
          placeholder="Minimum 8 caractères"
        />
        <AppUiInput
          v-model="confirmPassword"
          label="Confirmer le mot de passe"
          type="password"
          autocomplete="new-password"
          placeholder="••••••••"
        />
        <div class="flex flex-wrap items-center gap-3">
          <AppUiButton type="submit" variant="secondary" :loading="passwordLoading">
            {{ user?.hasPassword === false ? 'Définir un mot de passe' : 'Changer le mot de passe' }}
          </AppUiButton>
          <p v-if="passwordSaved" class="text-sm text-emerald-600">Mot de passe mis à jour.</p>
          <p v-if="passwordError" class="text-sm text-red-500">{{ passwordError }}</p>
        </div>
      </form>
    </AppUiCard>

    <AppUiCard v-if="recentEntries.length" title="Activité récente" class="mt-4">
      <div class="space-y-3">
        <div
          v-for="entry in recentEntries"
          :key="entry.id"
          class="flex items-center justify-between rounded-app-control bg-app-canvas px-4 py-3"
        >
          <div>
            <p class="text-sm font-semibold text-app-ink">
              {{ walletTypeLabels[entry.type] ?? entry.type }}
            </p>
            <p class="text-xs text-app-secondary">
              {{ new Date(entry.createdAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              }) }}
            </p>
          </div>
          <span class="font-semibold" :class="entry.amount >= 0 ? 'text-emerald-600' : 'text-red-500'">
            {{ entry.amount >= 0 ? '+' : '' }}{{ entry.amount }}
          </span>
        </div>
      </div>
      <NuxtLink to="/app/historique" class="mt-4 inline-flex text-sm font-semibold text-app-blue">
        Tout l'historique →
      </NuxtLink>
    </AppUiCard>

    <AppUiCard title="Raccourcis" class="mt-4">
      <div class="grid gap-2 sm:grid-cols-2">
        <NuxtLink
          v-for="link in quickLinks"
          :key="link.to"
          :to="link.to"
          class="flex min-h-11 items-center gap-3 rounded-app-control bg-app-canvas px-4 py-3 text-sm font-semibold text-app-ink transition hover:bg-app-mist hover:text-app-blue"
        >
          <AppIcon :name="link.icon" class="h-5 w-5 text-app-blue" />
          {{ link.label }}
        </NuxtLink>
      </div>
    </AppUiCard>

    <AppUiCard v-if="pwa?.showInstallPrompt && !pwa?.isPWAInstalled" title="Application" class="mt-4">
      <p class="text-sm text-app-secondary">
        Installez Focus sur votre écran d'accueil pour un accès rapide, comme une application native.
      </p>
      <AppUiButton variant="secondary" class="mt-4" @click="installPwa">
        Installer l'application
      </AppUiButton>
    </AppUiCard>

    <AppUiCard v-if="userjotEnabled" title="Aide & feedback" class="mt-4">
      <p class="text-sm text-app-secondary">
        Partagez vos idées, signalez un bug ou votez pour les prochaines fonctionnalités.
      </p>
      <AppUiButton variant="secondary" class="mt-4" @click="showFeedback">
        Donner un avis
      </AppUiButton>
    </AppUiCard>

    <AppUiCard title="Compte" class="mt-4">
      <div class="space-y-3">
        <NuxtLink
          v-if="isAdmin"
          to="/admin"
          class="app-button-secondary inline-flex w-full justify-center sm:w-auto"
        >
          Administration
        </NuxtLink>
        <div>
          <AppUiButton variant="ghost" class="!text-red-500" @click="logout">
            Déconnexion
          </AppUiButton>
        </div>
      </div>
    </AppUiCard>
  </div>
</template>
