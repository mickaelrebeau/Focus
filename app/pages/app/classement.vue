<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })

const { data, isLoading } = useLeaderboard()
const { user } = useAuth()

const leaderboard = computed(() => data.value?.leaderboard ?? [])
const weeklyProgress = computed(() => data.value?.weeklyProgress)
const top3 = computed(() => leaderboard.value.slice(0, 3))
const rest = computed(() => leaderboard.value.slice(3))
</script>

<template>
  <div class="overflow-x-hidden p-4 sm:p-5 md:p-8">
    <h1 class="focus-heading-lg">Classement</h1>
    <p class="focus-body mt-2">Score net = crédits − dette</p>

    <UiCard class="mt-6">
      <p class="focus-label">Cagnottes associatives</p>
      <p class="mt-1 text-sm text-focus-gray-600">
        Les dons issus des conséquences sont cumulés par association et reversés manuellement chaque mois.
      </p>
      <NuxtLink
        to="/cagnottes"
        class="mt-3 inline-flex text-sm font-medium text-focus-accent hover:opacity-80"
      >
        Voir les cagnottes publiques →
      </NuxtLink>
    </UiCard>

    <UiCard v-if="weeklyProgress" class="mt-6">
      <p class="focus-label">Bonus Top 3 hebdomadaire</p>
      <p class="mt-1 text-sm text-focus-gray-600">
        Restez dans le Top 3 chaque jour cette semaine pour gagner
        <span class="font-medium">10 / 5 / 2 crédits</span> selon votre rang final du dimanche.
      </p>
      <div class="mt-4 flex items-center justify-between text-sm">
        <span class="text-focus-gray-500">Jours qualifiés</span>
        <span class="font-semibold text-focus-gray-900">
          {{ weeklyProgress.daysQualified }} / {{ weeklyProgress.daysRequired }}
        </span>
      </div>
      <div class="mt-2 h-2 overflow-hidden rounded-full bg-focus-gray-100">
        <div
          class="h-full rounded-full bg-focus-accent transition-all duration-500"
          :style="{ width: `${Math.round((weeklyProgress.daysQualified / weeklyProgress.daysRequired) * 100)}%` }"
        />
      </div>
      <p v-if="weeklyProgress.projectedRank" class="mt-2 text-xs text-focus-gray-400">
        Rang actuel projeté : Top {{ weeklyProgress.projectedRank }}
      </p>
    </UiCard>

    <div v-if="isLoading" class="mt-8 space-y-3">
      <div class="focus-card h-40 animate-pulse bg-focus-gray-50" />
      <div v-for="i in 5" :key="i" class="focus-card h-14 animate-pulse bg-focus-gray-50" />
    </div>

    <div v-else-if="!leaderboard.length" class="focus-card mt-8 py-12 text-center text-focus-gray-400">
      Aucun participant au classement pour le moment.
    </div>

    <template v-else>
      <section class="mx-auto mt-8 max-w-[800px]">
        <LeaderboardPodium
          :entries="top3"
          :current-user-id="user?.id"
        />
      </section>

      <section v-if="rest.length" class="mx-auto mt-8 max-w-[800px]">
        <p class="focus-label mb-3">Classement complet</p>
        <div class="space-y-3">
          <div
            v-for="entry in rest"
            :key="entry.userId"
            class="focus-card flex items-start justify-between gap-3 sm:items-center"
            :class="{ 'border-focus-accent': entry.isCurrentUser }"
          >
            <div class="flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-4">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-focus-gray-100 text-sm font-semibold">
                {{ entry.rank }}
              </span>
              <div class="min-w-0">
                <p class="truncate font-medium text-focus-gray-900">
                  {{ entry.displayName }}
                  <span v-if="entry.isCurrentUser" class="ml-1 text-xs text-focus-accent">(vous)</span>
                </p>
                <p class="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-focus-gray-400">
                  <span>{{ entry.balance }} cr</span>
                  <span>{{ entry.debt }} dette</span>
                  <span>{{ entry.currentStreak }}j streak</span>
                </p>
              </div>
            </div>
            <p
              class="shrink-0 text-base font-semibold tabular-nums sm:text-lg"
              :class="entry.netScore >= 0 ? 'text-focus-gray-900' : 'text-red-500'"
            >
              {{ entry.netScore }}
            </p>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
