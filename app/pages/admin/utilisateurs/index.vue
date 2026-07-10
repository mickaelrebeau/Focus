<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'admin'] })

const search = ref('')
const { data, refresh } = useFetch('/api/admin/users', {
  query: computed(() => ({ search: search.value || undefined })),
})
</script>

<template>
  <div>
    <h1 class="focus-heading-lg">Utilisateurs</h1>
    <UiInput v-model="search" class="mt-6 max-w-sm" placeholder="Rechercher..." />

    <div class="mt-6 overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-focus-gray-200 text-focus-gray-400">
            <th class="pb-3 pr-4">Nom</th>
            <th class="pb-3 pr-4">Email</th>
            <th class="pb-3 pr-4">Rôle</th>
            <th class="pb-3 pr-4">Crédits</th>
            <th class="pb-3 pr-4">Dette</th>
            <th class="pb-3">Score</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in data?.users ?? []" :key="u.id" class="border-b border-focus-gray-100">
            <td class="py-3 pr-4">
              <NuxtLink :to="`/admin/utilisateurs/${u.id}`" class="font-medium hover:underline">
                {{ u.displayName }}
              </NuxtLink>
            </td>
            <td class="py-3 pr-4 text-focus-gray-500">{{ u.email }}</td>
            <td class="py-3 pr-4">
              <UiBadge :variant="u.role === 'admin' ? 'warning' : 'neutral'">{{ u.role }}</UiBadge>
            </td>
            <td class="py-3 pr-4">{{ u.balance ?? 0 }}</td>
            <td class="py-3 pr-4">{{ u.debt ?? 0 }}</td>
            <td class="py-3 font-medium">{{ u.netScore }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
