<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'admin'] })

const { data } = useFetch('/api/admin/audit')
</script>

<template>
  <div>
    <h1 class="focus-heading-lg">Journal d'audit</h1>

    <div class="mt-8 space-y-3">
      <div v-for="log in data?.logs ?? []" :key="log.id" class="focus-card text-sm">
        <div class="flex justify-between">
          <span class="font-medium">{{ log.action }}</span>
          <span class="text-focus-gray-400">
            {{ new Date(log.createdAt).toLocaleString('fr-FR') }}
          </span>
        </div>
        <p class="text-focus-gray-500">
          {{ log.actor?.displayName ?? 'Système' }} — {{ log.entityType }}
          <span v-if="log.entityId">#{{ log.entityId.slice(0, 8) }}</span>
        </p>
      </div>
    </div>
  </div>
</template>
