<script setup lang="ts">
import OccurrenceCard from '~/components/OccurrenceCard.vue'

definePageMeta({ layout: 'app', middleware: 'auth' })

const { user } = useAuth()
const filter = ref('today')
const { data: occurrencesData, isPending: occurrencesLoading, completeOccurrence } = useOccurrences(filter)

const showCompleteModal = ref(false)
const selectedOccurrenceId = ref('')
const note = ref('')
const proofUrl = ref('')

function openComplete(id: string) {
  selectedOccurrenceId.value = id
  note.value = ''
  proofUrl.value = ''
  showCompleteModal.value = true
}

async function submitComplete() {
  await completeOccurrence.mutateAsync({
    id: selectedOccurrenceId.value,
    note: note.value || undefined,
    proofType: proofUrl.value ? 'url' : undefined,
    proofUrl: proofUrl.value || undefined,
  })
  showCompleteModal.value = false
  const { fetchUser } = useAuth()
  await fetchUser()
}
</script>

<template>
  <div class="p-5 md:p-8">
    <div class="mb-8">
      <p class="focus-label">Bonjour</p>
      <h1 class="focus-heading-lg">{{ user?.displayName }}</h1>
      <div class="mt-4 flex gap-6">
        <div>
          <p class="text-2xl font-semibold text-focus-gray-900">{{ user?.credits ?? 0 }}</p>
          <p class="text-xs text-focus-gray-400">Crédits</p>
        </div>
        <div v-if="user?.debt">
          <p class="text-2xl font-semibold text-red-500">{{ user.debt }}</p>
          <p class="text-xs text-focus-gray-400">Dette</p>
        </div>
        <div>
          <p class="text-2xl font-semibold text-focus-accent">{{ user?.netScore ?? 0 }}</p>
          <p class="text-xs text-focus-gray-400">Score net</p>
        </div>
      </div>
    </div>

    <div class="mb-6 flex items-center justify-between">
      <h2 class="focus-heading-md">Échéances du jour</h2>
      <NuxtLink to="/app/objectifs/nouveau" class="focus-btn-primary text-xs">
        + Objectif
      </NuxtLink>
    </div>

    <div v-if="occurrencesLoading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="focus-card h-24 animate-pulse bg-focus-gray-50" />
    </div>

    <div v-else-if="!occurrencesData?.occurrences?.length" class="focus-card text-center py-12">
      <p class="text-focus-gray-400">Aucune échéance pour aujourd'hui.</p>
      <NuxtLink to="/app/objectifs/nouveau" class="focus-btn-secondary mt-4 inline-flex">
        Créer un objectif
      </NuxtLink>
    </div>

    <div v-else class="space-y-4">
      <OccurrenceCard
        v-for="occ in occurrencesData.occurrences"
        :key="occ.id"
        :occurrence="occ"
        @complete="openComplete"
      />
    </div>

    <!-- Complete modal -->
    <Teleport to="body">
      <div v-if="showCompleteModal" class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" @click.self="showCompleteModal = false">
        <div class="w-full max-w-md rounded-focus-xl bg-focus-white p-6 shadow-focus-lg">
          <h3 class="focus-heading-md">Valider l'échéance</h3>
          <p class="focus-body-sm mt-2">Ajoutez une note ou une preuve (facultatif).</p>
          <div class="mt-4 space-y-4">
            <UiInput v-model="note" label="Note" placeholder="Ce que j'ai accompli..." />
            <UiInput v-model="proofUrl" label="Lien de preuve" type="url" placeholder="https://..." />
          </div>
          <div class="mt-6 flex gap-3">
            <UiButton variant="secondary" class="flex-1" @click="showCompleteModal = false">Annuler</UiButton>
            <UiButton class="flex-1" :loading="completeOccurrence.isPending.value" @click="submitComplete">
              Valider (+10)
            </UiButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
