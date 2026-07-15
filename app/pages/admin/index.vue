<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'admin'] })

const { data, pending } = useFetch('/api/admin/stats', { credentials: 'include' })

const stats = computed(() => {
  const s = data.value?.stats
  if (!s) return []

  return [
    {
      label: 'Utilisateurs',
      value: s.users,
      hint: 'Comptes inscrits',
      tone: 'neutral' as const,
      icon: '◉',
    },
    {
      label: 'Objectifs actifs',
      value: s.activeGoals,
      hint: 'En cours',
      tone: 'accent' as const,
      icon: '◈',
    },
    {
      label: 'Validations en attente',
      value: s.pendingValidations,
      hint: 'À modérer',
      tone: s.pendingValidations > 0 ? 'warning' as const : 'neutral' as const,
      icon: '◎',
    },
    {
      label: 'Échéances échouées',
      value: s.failedOccurrences,
      hint: 'Total',
      tone: s.failedOccurrences > 0 ? 'danger' as const : 'neutral' as const,
      icon: '△',
    },
    {
      label: 'Crédits en circulation',
      value: s.totalCredits,
      hint: 'Solde cumulé',
      tone: 'success' as const,
      icon: '+',
    },
    {
      label: 'Dette totale',
      value: s.totalDebt,
      hint: 'À rembourser',
      tone: s.totalDebt > 0 ? 'danger' as const : 'neutral' as const,
      icon: '−',
    },
  ]
})

const hasAlerts = computed(() => {
  const s = data.value?.stats
  return (s?.pendingValidations ?? 0) > 0 || (s?.failedOccurrences ?? 0) > 0
})

const actions = [
  {
    to: '/admin/moderation',
    label: 'Modération',
    description: 'Valider ou rejeter les preuves soumises',
    icon: '◎',
    highlight: computed(() => (data.value?.stats?.pendingValidations ?? 0) > 0),
  },
  {
    to: '/admin/utilisateurs',
    label: 'Utilisateurs',
    description: 'Consulter les profils et ajuster les crédits',
    icon: '◉',
    highlight: computed(() => false),
  },
  {
    to: '/admin/cagnotte',
    label: 'Cagnotte commune',
    description: 'Suivre la cagnotte et enregistrer les reversements mensuels',
    icon: '◎',
    highlight: computed(() => false),
  },
  {
    to: '/admin/echeances',
    label: 'Échéances',
    description: 'Suivre les occurrences et leur statut',
    icon: '◷',
    highlight: computed(() => (data.value?.stats?.failedOccurrences ?? 0) > 0),
  },
  {
    to: '/admin/audit',
    label: 'Journal d\'audit',
    description: 'Historique des actions administrateur',
    icon: '◫',
    highlight: computed(() => false),
  },
]

const toneClasses = {
  neutral: 'border-focus-gray-200 bg-focus-white',
  accent: 'border-focus-accent/20 bg-focus-accent/5',
  warning: 'border-amber-200 bg-amber-50',
  danger: 'border-red-200 bg-red-50',
  success: 'border-emerald-200 bg-emerald-50',
}

const toneValueClasses = {
  neutral: 'text-focus-gray-900',
  accent: 'text-focus-accent',
  warning: 'text-amber-700',
  danger: 'text-red-600',
  success: 'text-emerald-700',
}
</script>

<template>
  <div>
    <div class="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="focus-heading-lg">Tableau de bord</h1>
        <p class="focus-body-sm mt-1">Vue d'ensemble de l'activité sur Focus.</p>
      </div>
      <NuxtLink to="/app" class="focus-btn-secondary text-sm">
        ← Retour à l'app
      </NuxtLink>
    </div>

    <div
      v-if="hasAlerts && !pending"
      class="mb-6 rounded-focus-lg border border-amber-200 bg-amber-50 px-5 py-4"
    >
      <p class="text-sm font-medium text-amber-800">Actions requises</p>
      <p class="mt-1 text-sm text-amber-700">
        <span v-if="data?.stats?.pendingValidations">
          {{ data.stats.pendingValidations }} validation{{ data.stats.pendingValidations > 1 ? 's' : '' }} en attente.
        </span>
        <span v-if="data?.stats?.pendingValidations && data?.stats?.failedOccurrences"> · </span>
        <span v-if="data?.stats?.failedOccurrences">
          {{ data.stats.failedOccurrences }} échéance{{ data.stats.failedOccurrences > 1 ? 's' : '' }} échouée{{ data.stats.failedOccurrences > 1 ? 's' : '' }}.
        </span>
      </p>
    </div>

    <div v-if="pending" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 6" :key="i" class="focus-card h-28 animate-pulse bg-focus-gray-50" />
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="rounded-focus-lg border p-5 shadow-focus"
        :class="toneClasses[stat.tone]"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm text-focus-gray-500">{{ stat.label }}</p>
            <p class="mt-2 text-3xl font-semibold" :class="toneValueClasses[stat.tone]">
              {{ stat.value }}
            </p>
          </div>
          <span
            class="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-lg text-focus-gray-400"
          >
            {{ stat.icon }}
          </span>
        </div>
        <p class="mt-3 text-xs text-focus-gray-400">{{ stat.hint }}</p>
      </div>
    </div>

    <section class="mt-10">
      <h2 class="focus-heading-md">Actions rapides</h2>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <NuxtLink
          v-for="action in actions"
          :key="action.to"
          :to="action.to"
          class="group rounded-focus-lg border border-focus-gray-200 bg-focus-white p-5 shadow-focus transition hover:border-focus-gray-300 hover:shadow-focus-lg"
          :class="action.highlight.value ? 'border-amber-200 bg-amber-50/40' : ''"
        >
          <div class="flex items-start gap-4">
            <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-focus-gray-100 text-lg text-focus-gray-500 transition group-hover:bg-focus-gray-900 group-hover:text-white">
              {{ action.icon }}
            </span>
            <div>
              <p class="font-medium text-focus-gray-900">{{ action.label }}</p>
              <p class="mt-1 text-sm text-focus-gray-400">{{ action.description }}</p>
            </div>
          </div>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
