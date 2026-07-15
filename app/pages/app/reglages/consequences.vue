<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })

import ConsequenceList from '~/components/consequences/ConsequenceList.vue'
import ConsequenceTypePicker from '~/components/consequences/ConsequenceTypePicker.vue'
import {
  eurosToCents,
  isMonetaryConsequenceType,
  useConsequenceTypes,
  useUserConsequences,
} from '~/composables/useConsequences'

const {
  data: typesData,
  isLoading: typesLoading,
} = useConsequenceTypes()

const { data: consequencesData,
  isLoading: consequencesLoading,
  createConsequence,
  updateConsequence,
  deleteConsequence,
  reorderConsequences,
  estimateConsequence,
} = useUserConsequences()

const { user } = useAuth()

const savingId = ref<string | null>(null)
const feedback = ref('')
const error = ref('')
const estimates = ref<Record<string, { label: string, description: string } | null>>({})

const types = computed(() => typesData.value?.types ?? [])
const consequences = computed(() => consequencesData.value?.consequences ?? [])
const configuredTypes = computed(() => consequences.value.map(item => item.type))

const isLoading = computed(() => typesLoading.value || consequencesLoading.value)

function defaultAmount(type: string): number {
  if (type === 'credits' || type === 'random-user') return 20
  if (type === 'custom') return 0
  return eurosToCents(5)
}

function defaultConfig(type: string): Record<string, unknown> {
  if (type === 'donation') return { association: 'wwf' }
  if (type === 'random-user') return { minimumScore: 0 }
  if (type === 'custom') return { message: 'Faire 100 pompes' }
  return {}
}

async function refreshEstimate(consequence: {
  id: string
  type: string
  amount: number
  config: Record<string, unknown>
}) {
  try {
    const result = await estimateConsequence.mutateAsync({
      type: consequence.type,
      amount: consequence.amount,
      config: consequence.config,
    })
    estimates.value[consequence.id] = result.estimate
  } catch {
    estimates.value[consequence.id] = null
  }
}

watch(consequences, async (items) => {
  for (const item of items) {
    await refreshEstimate(item)
  }
}, { immediate: true, deep: true })

async function handleAdd(type: string) {
  error.value = ''
  feedback.value = ''

  try {
    await createConsequence.mutateAsync({
      type,
      enabled: !isMonetaryConsequenceType(type),
      amount: defaultAmount(type),
      config: defaultConfig(type),
    })
    feedback.value = 'Conséquence ajoutée.'
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } }
    error.value = fetchError?.data?.message ?? 'Impossible d\'ajouter la conséquence'
  }
}

async function handleUpdate(
  id: string,
  payload: {
    enabled?: boolean
    amount?: number
    config?: Record<string, unknown>
  },
) {
  error.value = ''
  feedback.value = ''
  savingId.value = id

  try {
    const result = await updateConsequence.mutateAsync({ id, ...payload })
    if (result.consequence) {
      await refreshEstimate(result.consequence)
    }
    feedback.value = 'Conséquence mise à jour.'
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } }
    error.value = fetchError?.data?.message ?? 'Impossible de mettre à jour la conséquence'
  } finally {
    savingId.value = null
  }
}

async function handleRemove(id: string) {
  error.value = ''
  feedback.value = ''

  try {
    await deleteConsequence.mutateAsync(id)
    delete estimates.value[id]
    feedback.value = 'Conséquence supprimée.'
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } }
    error.value = fetchError?.data?.message ?? 'Impossible de supprimer la conséquence'
  }
}

async function handleReorder(orderedIds: string[]) {
  error.value = ''

  try {
    await reorderConsequences.mutateAsync(orderedIds)
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } }
    error.value = fetchError?.data?.message ?? 'Impossible de réordonner les conséquences'
  }
}
</script>

<template>
  <div class="p-5 md:p-8">
    <div class="mb-6">
      <NuxtLink
        to="/app/reglages"
        class="mb-3 inline-flex text-sm text-focus-gray-400 hover:text-focus-gray-700"
      >
        ← Retour aux réglages
      </NuxtLink>
      <h1 class="focus-heading-lg">Conséquences</h1>
      <p class="focus-body-sm mt-1">
        Configurez ce qui se passe automatiquement lorsqu'un objectif échoue.
      </p>
    </div>

    <UiCard class="mb-6">
      <p class="text-sm text-focus-gray-500">
        Les conséquences actives sont exécutées dans l'ordre de priorité.
        Faites glisser les cartes ou utilisez les flèches pour réorganiser.
      </p>
    </UiCard>

    <UiCard
      v-if="!user?.hasPaymentMethod"
      class="mb-6 border-amber-200 bg-amber-50"
    >
      <p class="text-sm font-medium text-amber-900">Carte bancaire requise</p>
      <p class="mt-1 text-sm text-amber-800">
        Les conséquences monétaires (cagnotte, don, utilisateur aléatoire, Stripe)
        nécessitent une carte enregistrée dans vos réglages.
      </p>
      <NuxtLink
        to="/app/reglages#paiement"
        class="mt-3 inline-flex text-sm font-medium text-focus-accent hover:opacity-80"
      >
        Configurer ma carte →
      </NuxtLink>
    </UiCard>

    <div v-if="isLoading" class="py-12 text-center text-sm text-focus-gray-400">
      Chargement...
    </div>

    <template v-else>
      <ConsequenceList
        v-if="consequences.length"
        :consequences="consequences"
        :types="types"
        :estimates="estimates"
        :saving-id="savingId"
        @update="handleUpdate"
        @remove="handleRemove"
        @reorder="handleReorder"
      />

      <UiCard v-else title="Aucune conséquence">
        <p class="text-sm text-focus-gray-500">
          Ajoutez votre première conséquence pour personnaliser les pénalités d'échec.
        </p>
      </UiCard>

      <ConsequenceTypePicker
        class="mt-6"
        :types="types"
        :configured-types="configuredTypes"
        @add="handleAdd"
      />

      <div class="mt-6 flex flex-wrap items-center gap-3">
        <p v-if="feedback" class="text-sm text-emerald-600">{{ feedback }}</p>
        <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
      </div>
    </template>
  </div>
</template>
