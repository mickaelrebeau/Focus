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
  <div class="app-page animate-fade-in overflow-x-hidden">
    <p class="app-eyebrow">Communauté</p>
    <h1 class="app-heading mt-1">Classement</h1>
    <p class="mt-1 text-sm text-app-secondary">Score net = crédits − dette</p>

    <div class="app-sheet mt-6 p-5">
      <p class="app-eyebrow">Cagnottes associatives</p>
      <p class="mt-1 text-sm text-app-secondary">
        Les dons issus des conséquences sont cumulés par association et reversés manuellement chaque mois.
      </p>
      <NuxtLink
        to="/cagnottes"
        class="mt-3 inline-flex text-sm font-semibold text-app-blue"
      >
        Voir les cagnottes →
      </NuxtLink>
    </div>

    <div v-if="weeklyProgress" class="app-sheet mt-4 p-5">
      <p class="app-eyebrow">Bonus Top 3 hebdomadaire</p>
      <p class="mt-1 text-sm text-app-secondary">
        Restez dans le Top 3 chaque jour cette semaine pour gagner
        <span class="font-semibold text-app-ink">10 / 5 / 2 crédits</span>.
      </p>
      <div class="mt-4 flex items-center justify-between text-sm">
        <span class="text-app-secondary">Jours qualifiés</span>
        <span class="font-semibold text-app-ink">
          {{ weeklyProgress.daysQualified }} / {{ weeklyProgress.daysRequired }}
        </span>
      </div>
      <div class="app-progress mt-2">
        <div
          class="app-progress-bar"
          :style="{ width: `${Math.round((weeklyProgress.daysQualified / weeklyProgress.daysRequired) * 100)}%` }"
        />
      </div>
      <p v-if="weeklyProgress.projectedRank" class="mt-2 text-xs text-app-secondary">
        Rang actuel projeté : Top {{ weeklyProgress.projectedRank }}
      </p>
    </div>

    <div v-if="isLoading" class="mt-8 space-y-3">
      <div class="app-sheet h-40 animate-pulse" />
      <div v-for="i in 5" :key="i" class="app-row h-14 animate-pulse" />
    </div>

    <div v-else-if="!leaderboard.length" class="app-sheet mt-8 py-12 text-center text-sm text-app-secondary">
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
        <p class="app-eyebrow mb-3">Classement complet</p>
        <div class="space-y-3">
          <div
            v-for="entry in rest"
            :key="entry.userId"
            class="app-row flex items-start justify-between gap-3 sm:items-center"
            :class="{ 'ring-2 ring-app-blue/30': entry.isCurrentUser }"
          >
            <div class="flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-4">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-mist text-sm font-semibold text-app-blue">
                {{ entry.rank }}
              </span>
              <div class="min-w-0">
                <p class="truncate font-semibold text-app-ink">
                  {{ entry.displayName }}
                  <span v-if="entry.isCurrentUser" class="ml-1 text-xs text-app-blue">(vous)</span>
                </p>
                <p class="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-app-secondary">
                  <span>{{ entry.balance }} cr</span>
                  <span>{{ entry.debt }} dette</span>
                  <span>{{ entry.currentStreak }}j streak</span>
                </p>
              </div>
            </div>
            <p
              class="shrink-0 text-base font-semibold tabular-nums sm:text-lg"
              :class="entry.netScore >= 0 ? 'text-app-ink' : 'text-red-500'"
            >
              {{ entry.netScore }}
            </p>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
