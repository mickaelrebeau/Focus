<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })

const filter = ref<string | undefined>(undefined)
const { occurrencesQuery } = useOccurrences(filter)
</script>

<template>
  <div class="p-5 md:p-8">
    <h1 class="focus-heading-lg">Agenda</h1>
    <div class="mt-4 flex gap-2 overflow-x-auto">
      <button
        v-for="f in [
          { value: undefined, label: 'Tout' },
          { value: 'pending', label: 'À faire' },
          { value: 'overdue', label: 'En retard' },
        ]"
        :key="f.label"
        class="shrink-0 rounded-full px-4 py-2 text-sm font-medium transition"
        :class="filter === f.value ? 'bg-focus-black text-white' : 'bg-focus-gray-100 text-focus-gray-600'"
        @click="filter = f.value"
      >
        {{ f.label }}
      </button>
    </div>

    <div class="mt-6 space-y-4">
      <OccurrenceCard
        v-for="occ in occurrencesQuery.data?.occurrences ?? []"
        :key="occ.id"
        :occurrence="occ"
      />
    </div>
  </div>
</template>
