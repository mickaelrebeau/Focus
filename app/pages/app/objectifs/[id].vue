<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })

const route = useRoute()
const id = route.params.id as string

const { data, pending } = useFetch(() => `/api/goals/${id}`)
</script>

<template>
  <div class="p-5 md:p-8">
    <div v-if="pending" class="focus-card h-40 animate-pulse bg-focus-gray-50" />

    <template v-else-if="data">
      <NuxtLink to="/app/objectifs" class="text-sm text-focus-gray-400 hover:text-focus-gray-700">← Objectifs</NuxtLink>
      <h1 class="focus-heading-lg mt-4">{{ data.goal.title }}</h1>
      <p v-if="data.goal.description" class="focus-body mt-2">{{ data.goal.description }}</p>

      <div class="mt-6 flex gap-4 text-sm text-focus-gray-400">
        <span>+{{ data.goal.rewardCredits }} crédits</span>
        <span>-{{ data.goal.penaltyCredits }} pénalité</span>
      </div>

      <div v-if="data.goal.milestones?.length" class="mt-8">
        <h2 class="focus-heading-md">Jalons</h2>
        <div class="mt-4 space-y-3">
          <div v-for="m in data.goal.milestones" :key="m.id" class="focus-card">
            <h3 class="font-medium">{{ m.title }}</h3>
            <p v-if="m.dueDate" class="text-xs text-focus-gray-400">{{ m.dueDate }}</p>
          </div>
        </div>
      </div>

      <div class="mt-8">
        <h2 class="focus-heading-md">Échéances</h2>
        <div class="mt-4 space-y-3">
          <div v-for="occ in data.occurrences" :key="occ.id" class="flex items-center justify-between rounded-focus border border-focus-gray-100 px-4 py-3">
            <span class="text-sm">{{ occ.dueDate }}</span>
            <UiBadge :variant="occ.status === 'completed' ? 'success' : occ.status === 'failed' ? 'danger' : 'neutral'">
              {{ occ.status }}
            </UiBadge>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
