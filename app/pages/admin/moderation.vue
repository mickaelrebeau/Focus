<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'admin'] })

const { data, refresh } = useFetch('/api/admin/validations')

async function review(id: string, status: 'approved' | 'rejected') {
  await $fetch(`/api/admin/validations/${id}/review`, {
    method: 'POST',
    body: { status },
  })
  await refresh()
}
</script>

<template>
  <div>
    <h1 class="focus-heading-lg">Modération</h1>
    <p class="focus-body mt-2">Validations en attente de revue</p>

    <div v-if="!data?.validations?.length" class="focus-card mt-8 py-12 text-center text-focus-gray-400">
      Aucune validation en attente.
    </div>

    <div v-else class="mt-8 space-y-4">
      <UiCard v-for="v in data.validations" :key="v.id">
        <div class="flex items-start justify-between">
          <div>
            <p class="font-medium">{{ v.user.displayName }} — {{ v.goal.title }}</p>
            <p v-if="v.note" class="focus-body-sm mt-2">{{ v.note }}</p>
            <a v-if="v.proofUrl" :href="v.proofUrl" target="_blank" class="text-sm text-focus-accent hover:underline">
              Voir la preuve
            </a>
          </div>
          <div class="flex gap-2">
            <UiButton variant="secondary" class="text-xs" @click="review(v.id, 'approved')">Approuver</UiButton>
            <UiButton variant="ghost" class="text-xs text-red-500" @click="review(v.id, 'rejected')">Refuser</UiButton>
          </div>
        </div>
      </UiCard>
    </div>
  </div>
</template>
