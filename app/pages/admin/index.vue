<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'admin'] })

const { data } = useFetch('/api/admin/stats')

const stats = computed(() => {
  const s = data.value?.stats
  if (!s) return []
  return [
    { label: 'Utilisateurs', value: s.users },
    { label: 'Objectifs actifs', value: s.activeGoals },
    { label: 'Validations en attente', value: s.pendingValidations },
    { label: 'Échéances échouées', value: s.failedOccurrences },
    { label: 'Crédits en circulation', value: s.totalCredits },
    { label: 'Dette totale', value: s.totalDebt },
  ]
})
</script>

<template>
  <div>
    <h1 class="focus-heading-lg">Tableau de bord</h1>

    <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <UiCard v-for="stat in stats" :key="stat.label">
        <p class="text-sm text-focus-gray-400">{{ stat.label }}</p>
        <p class="mt-1 text-3xl font-semibold text-focus-gray-900">{{ stat.value }}</p>
      </UiCard>
    </div>

    <div class="mt-8 flex gap-4">
      <NuxtLink to="/admin/utilisateurs" class="focus-btn-secondary">Gérer les utilisateurs</NuxtLink>
      <NuxtLink to="/admin/moderation" class="focus-btn-secondary">Modération</NuxtLink>
    </div>
  </div>
</template>
