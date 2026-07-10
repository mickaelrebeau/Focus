<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'admin'] })

const { data } = useFetch('/api/admin/occurrences')
</script>

<template>
  <div>
    <h1 class="focus-heading-lg">Échéances en retard</h1>
    <p class="focus-body mt-2">Occurrences expirées non encore traitées par le worker.</p>

    <div class="mt-8 space-y-3">
      <UiCard v-for="occ in data?.occurrences ?? []" :key="occ.id">
        <div class="flex justify-between">
          <div>
            <p class="font-medium">{{ occ.goal.title }}</p>
            <p class="text-sm text-focus-gray-500">{{ occ.user.displayName }} ({{ occ.user.email }})</p>
            <p class="text-xs text-focus-gray-400">{{ occ.dueDate }}</p>
          </div>
          <UiBadge variant="warning">En retard</UiBadge>
        </div>
      </UiCard>
    </div>
  </div>
</template>
