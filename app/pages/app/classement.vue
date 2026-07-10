<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })

const { data, isLoading } = useLeaderboard()
const { user } = useAuth()
</script>

<template>
  <div class="p-5 md:p-8">
    <h1 class="focus-heading-lg">Classement</h1>
    <p class="focus-body mt-2">Score net = crédits − dette</p>

    <div v-if="isLoading" class="mt-8 space-y-3">
      <div v-for="i in 5" :key="i" class="focus-card h-14 animate-pulse bg-focus-gray-50" />
    </div>

    <div v-else class="mt-8 space-y-3">
      <div
        v-for="entry in data?.leaderboard ?? []"
        :key="entry.rank"
        class="focus-card flex items-center justify-between"
        :class="{ 'border-focus-accent': entry.displayName === user?.displayName }"
      >
        <div class="flex items-center gap-4">
          <span class="flex h-8 w-8 items-center justify-center rounded-full bg-focus-gray-100 text-sm font-semibold">
            {{ entry.rank }}
          </span>
          <div>
            <p class="font-medium text-focus-gray-900">{{ entry.displayName }}</p>
            <p class="text-xs text-focus-gray-400">{{ entry.balance }} crédits · {{ entry.debt }} dette</p>
          </div>
        </div>
        <p class="text-lg font-semibold" :class="entry.netScore >= 0 ? 'text-focus-gray-900' : 'text-red-500'">
          {{ entry.netScore }}
        </p>
      </div>
    </div>
  </div>
</template>
