<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })

const { data: goalsData, isPending: goalsLoading } = useGoals()

const typeLabels: Record<string, string> = {
  one_time: 'Ponctuel',
  recurring: 'Récurrent',
  project: 'Projet',
}
</script>

<template>
  <div class="p-5 md:p-8">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="focus-heading-lg">Objectifs</h1>
      <NuxtLink to="/app/objectifs/nouveau" class="focus-btn-primary text-sm">
        + Nouveau
      </NuxtLink>
    </div>

    <div v-if="goalsLoading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="focus-card h-20 animate-pulse bg-focus-gray-50" />
    </div>

    <div v-else-if="!goalsData?.goals?.length" class="focus-card py-12 text-center">
      <p class="text-focus-gray-400">Aucun objectif actif.</p>
      <NuxtLink to="/app/objectifs/nouveau" class="focus-btn-primary mt-4 inline-flex">
        Créer mon premier objectif
      </NuxtLink>
    </div>

    <div v-else class="space-y-4">
      <NuxtLink
        v-for="goal in goalsData.goals"
        :key="goal.id"
        :to="`/app/objectifs/${goal.id}`"
        class="focus-card block transition hover:border-focus-gray-300"
      >
        <div class="flex items-start justify-between">
          <div>
            <UiBadge variant="neutral">{{ typeLabels[goal.type] ?? goal.type }}</UiBadge>
            <h3 class="mt-2 font-medium text-focus-gray-900">{{ goal.title }}</h3>
            <p v-if="goal.description" class="focus-body-sm mt-1">{{ goal.description }}</p>
            <p v-if="goal.category" class="mt-1 text-xs text-focus-gray-400">{{ goal.category }}</p>
          </div>
          <div class="text-right text-xs text-focus-gray-400">
            <p>+{{ goal.rewardCredits }}</p>
            <p>-{{ goal.penaltyCredits }}</p>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
