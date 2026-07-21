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
  <div class="app-page animate-fade-in">
    <div class="mb-8 flex items-center justify-between gap-3">
      <div>
        <p class="app-eyebrow">Vos engagements</p>
        <h1 class="app-heading mt-1">Objectifs</h1>
        <p class="mt-1 text-sm text-app-secondary">
          {{ goalsData?.goals?.length ?? 0 }} actif{{ (goalsData?.goals?.length ?? 0) > 1 ? 's' : '' }}
        </p>
      </div>
      <NuxtLink
        to="/app/objectifs/nouveau"
        class="app-button-primary !px-4"
        aria-label="Nouvel objectif"
      >
        <AppIcon name="plus" class="h-4 w-4" />
        <span>Nouveau</span>
      </NuxtLink>
    </div>

    <div v-if="goalsLoading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="app-row h-20 animate-pulse" />
    </div>

    <div v-else-if="!goalsData?.goals?.length" class="app-sheet px-6 py-16 text-center">
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-app-mist text-app-blue">
        <AppIcon name="goals" class="h-6 w-6" />
      </div>
      <p class="mt-5 text-lg font-semibold text-app-ink">Aucun objectif actif</p>
      <p class="mx-auto mt-2 max-w-xs text-sm text-app-secondary">
        Créez votre premier engagement pour commencer à gagner des crédits.
      </p>
      <NuxtLink to="/app/objectifs/nouveau" class="app-button-primary mt-7 inline-flex">
        Créer mon premier objectif
      </NuxtLink>
    </div>

    <div v-else class="app-list-stagger space-y-3">
      <NuxtLink
        v-for="goal in goalsData.goals"
        :key="goal.id"
        :to="`/app/objectifs/${goal.id}`"
        class="app-row block"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <span class="app-chip-neutral">{{ typeLabels[goal.type] ?? goal.type }}</span>
            <h3 class="mt-2 truncate text-base font-semibold tracking-tight text-app-ink">
              {{ goal.title }}
            </h3>
            <p v-if="goal.description" class="mt-1 line-clamp-2 text-sm text-app-secondary">
              {{ goal.description }}
            </p>
          </div>
          <div class="shrink-0 text-right text-xs text-app-secondary">
            <p class="font-medium text-emerald-600">+{{ goal.rewardCredits }}</p>
            <p class="text-red-500">−{{ goal.penaltyCredits }}</p>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
