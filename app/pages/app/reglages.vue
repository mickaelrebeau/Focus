<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })

import { DEFAULT_TIMEZONE, getTimezoneLabel, isValidTimezone } from '#shared/timezones'

const { user, fetchUser, logout, isAdmin } = useAuth()
const { isEnabled: userjotEnabled, showFeedback } = useUserjot()
const { data: goalsData } = useGoals()
const { data: walletData } = useWalletHistory()

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

const quickLinks = [
  { to: '/app/objectifs', label: 'Mes objectifs', icon: '◈' },
  { to: '/app/agenda', label: 'Agenda', icon: '◷' },
  { to: '/app/historique', label: 'Historique crédits', icon: '◫' },
  { to: '/app/classement', label: 'Classement', icon: '▲' },
]

const walletTypeLabels: Record<string, string> = {
  task_reward: 'Récompense',
  task_penalty: 'Pénalité',
  debt_created: 'Dette créée',
  debt_repayment: 'Remboursement dette',
  admin_adjustment: 'Ajustement admin',
  signup_bonus: 'Bonus inscription',
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

async function changePassword() {
  passwordError.value = ''
  passwordSaved.value = false

  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Les mots de passe ne correspondent pas'
    return
  }

  passwordLoading.value = true

  try {
    await $fetch('/api/user/change-password', {
      method: 'POST',
      body: {
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
      },
      credentials: 'include',
    })
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    passwordSaved.value = true
  } catch (error: any) {
    passwordError.value = error?.data?.message ?? 'Impossible de changer le mot de passe'
  } finally {
    passwordLoading.value = false
  }
}
</script>

<template>
  <div class="p-5 md:p-8">
    <div class="mb-8">
      <h1 class="focus-heading-lg">Réglages</h1>
      <p class="focus-body-sm mt-1">Gérez votre profil, vos préférences et la sécurité de votre compte.</p>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <UiCard>
        <div class="flex items-center gap-4">
          <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-focus-gray-900 text-lg font-semibold text-white">
            {{ initials }}
          </div>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="truncate text-lg font-semibold text-focus-gray-900">
                {{ user?.displayName }}
              </h2>
              <UiBadge v-if="isAdmin" variant="neutral">Admin</UiBadge>
            </div>
            <p class="truncate text-sm text-focus-gray-400">{{ user?.email }}</p>
          </div>
        </div>
      </UiCard>

      <UiCard>
        <p class="focus-label mb-3">Portefeuille</p>
        <div class="grid grid-cols-3 gap-4">
          <div>
            <p class="text-2xl font-semibold text-focus-gray-900">{{ user?.credits ?? 0 }}</p>
            <p class="text-xs text-focus-gray-400">Crédits</p>
          </div>
          <div>
            <p class="text-2xl font-semibold" :class="user?.debt ? 'text-red-500' : 'text-focus-gray-900'">
              {{ user?.debt ?? 0 }}
            </p>
            <p class="text-xs text-focus-gray-400">Dette</p>
          </div>
          <div>
            <p class="text-2xl font-semibold text-focus-accent">{{ user?.netScore ?? 0 }}</p>
            <p class="text-xs text-focus-gray-400">Score net</p>
          </div>
        </div>
        <NuxtLink to="/app/historique" class="mt-4 inline-flex text-sm font-medium text-focus-accent hover:opacity-80">
          Voir l'historique complet →
        </NuxtLink>
      </UiCard>
    </div>

    <form class="mt-6 space-y-6" @submit.prevent="saveProfile">
      <UiCard title="Profil">
        <div class="space-y-5">
          <UiInput v-model="displayName" label="Nom d'affichage" placeholder="Votre nom public" />
          <UiInput :model-value="user?.email ?? ''" label="Email" type="email" disabled />
          <UiTimezoneSelect v-model="timezone" label="Fuseau horaire" />
          <p class="text-xs text-focus-gray-400">
            Les échéances sont calculées selon {{ timezoneLabel }}.
          </p>
        </div>
      </UiCard>

      <UiCard title="Préférences">
        <div class="space-y-4">
          <UiToggle
            v-model="leaderboardOptIn"
            label="Participer au classement"
            description="Votre score net apparaît dans le classement public. Vous pouvez le désactiver à tout moment."
          />
          <div class="rounded-focus bg-focus-gray-50 px-4 py-3 text-sm text-focus-gray-500">
            <span class="font-medium text-focus-gray-700">{{ activeGoalsCount }}</span>
            objectif{{ activeGoalsCount > 1 ? 's' : '' }} actif{{ activeGoalsCount > 1 ? 's' : '' }}
          </div>
        </div>
      </UiCard>

      <div class="flex flex-wrap items-center gap-3">
        <UiButton type="submit" :loading="profileLoading">Enregistrer les modifications</UiButton>
        <p v-if="profileSaved" class="text-sm text-emerald-600">Réglages enregistrés.</p>
        <p v-if="profileError" class="text-sm text-red-500">{{ profileError }}</p>
      </div>
    </form>

    <UiCard title="Sécurité" class="mt-6">
      <form class="max-w-lg space-y-5" @submit.prevent="changePassword">
        <UiInput
          v-model="currentPassword"
          label="Mot de passe actuel"
          type="password"
          autocomplete="current-password"
          placeholder="••••••••"
        />
        <UiInput
          v-model="newPassword"
          label="Nouveau mot de passe"
          type="password"
          autocomplete="new-password"
          placeholder="Minimum 8 caractères"
        />
        <UiInput
          v-model="confirmPassword"
          label="Confirmer le mot de passe"
          type="password"
          autocomplete="new-password"
          placeholder="••••••••"
        />
        <div class="flex flex-wrap items-center gap-3">
          <UiButton type="submit" variant="secondary" :loading="passwordLoading">
            Changer le mot de passe
          </UiButton>
          <p v-if="passwordSaved" class="text-sm text-emerald-600">Mot de passe mis à jour.</p>
          <p v-if="passwordError" class="text-sm text-red-500">{{ passwordError }}</p>
        </div>
      </form>
    </UiCard>

    <UiCard v-if="recentEntries.length" title="Activité récente" class="mt-6">
      <div class="space-y-3">
        <div
          v-for="entry in recentEntries"
          :key="entry.id"
          class="flex items-center justify-between rounded-focus border border-focus-gray-100 px-4 py-3"
        >
          <div>
            <p class="text-sm font-medium text-focus-gray-900">
              {{ walletTypeLabels[entry.type] ?? entry.type }}
            </p>
            <p class="text-xs text-focus-gray-400">
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
      <NuxtLink to="/app/historique" class="mt-4 inline-flex text-sm font-medium text-focus-accent hover:opacity-80">
        Tout l'historique →
      </NuxtLink>
    </UiCard>

    <UiCard title="Raccourcis" class="mt-6">
      <div class="grid gap-2 sm:grid-cols-2">
        <NuxtLink
          v-for="link in quickLinks"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-3 rounded-focus border border-focus-gray-200 px-4 py-3 text-sm font-medium text-focus-gray-700 transition hover:border-focus-gray-300 hover:bg-focus-gray-50"
        >
          <span class="text-base text-focus-gray-400">{{ link.icon }}</span>
          {{ link.label }}
        </NuxtLink>
        <button
          v-if="userjotEnabled"
          type="button"
          class="flex items-center gap-3 rounded-focus border border-focus-gray-200 px-4 py-3 text-sm font-medium text-focus-gray-700 transition hover:border-focus-gray-300 hover:bg-focus-gray-50"
          @click="showFeedback"
        >
          <span class="text-base text-focus-gray-400">✎</span>
          Donner un avis
        </button>
      </div>
    </UiCard>

    <UiCard title="Compte" class="mt-6">
      <div class="space-y-3">
        <NuxtLink
          v-if="isAdmin"
          to="/admin"
          class="focus-btn-secondary inline-flex w-full justify-center sm:w-auto"
        >
          ◆ Administration
        </NuxtLink>
        <div>
          <UiButton variant="ghost" class="text-red-500" @click="logout">
            Déconnexion
          </UiButton>
        </div>
      </div>
    </UiCard>
  </div>
</template>
