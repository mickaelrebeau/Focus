<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })

import AccountabilityContactForm from '~/components/consequences/AccountabilityContactForm.vue'
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
const { t } = useI18n()

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
  if (type === 'custom') return { message: t('consequences.defaultCustomMessage') }
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

// Message à un proche : contact et consentement sont saisis avant la création
const settingUpAccountability = ref(false)

async function handleAdd(type: string, config?: Record<string, unknown>) {
  error.value = ''
  feedback.value = ''
  if (type === 'accountability-message' && !config) {
    settingUpAccountability.value = true
    return
  }

  try {
    await createConsequence.mutateAsync({
      type,
      enabled: !isMonetaryConsequenceType(type),
      amount: defaultAmount(type),
      config: config ?? defaultConfig(type),
    })
    settingUpAccountability.value = false
    feedback.value = type === 'accountability-message' ? t('accountability.invited') : t('consequences.feedback.added')
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } }
    error.value = fetchError?.data?.message ?? t('consequences.errors.add')
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
    feedback.value = t('consequences.feedback.updated')
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } }
    error.value = fetchError?.data?.message ?? t('consequences.errors.update')
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
    feedback.value = t('consequences.feedback.removed')
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } }
    error.value = fetchError?.data?.message ?? t('consequences.errors.remove')
  }
}

async function handleReorder(orderedIds: string[]) {
  error.value = ''

  try {
    await reorderConsequences.mutateAsync(orderedIds)
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } }
    error.value = fetchError?.data?.message ?? t('consequences.errors.reorder')
  }
}
</script>

<template>
  <div class="app-page animate-fade-in">
    <div class="mb-6">
      <NuxtLink
        to="/app/reglages"
        class="mb-3 inline-flex text-sm font-medium text-app-secondary hover:text-app-blue"
      >
        {{ t('consequences.back') }}
      </NuxtLink>
      <p class="app-eyebrow">{{ t('consequences.eyebrow') }}</p>
      <h1 class="app-heading mt-1">{{ t('consequences.title') }}</h1>
      <p class="mt-1 text-sm text-app-secondary">
        {{ t('consequences.subtitle') }}
      </p>
    </div>

    <div class="app-sheet mb-4 p-5">
      <p class="text-sm text-app-secondary">
        {{ t('consequences.priorityHint') }}
      </p>
    </div>

    <div
      v-if="!user?.hasPaymentMethod"
      class="mb-4 rounded-app-card bg-app-mist p-5"
    >
      <p class="text-sm font-semibold text-app-blue">{{ t('consequences.cardRequired') }}</p>
      <p class="mt-1 text-sm text-app-secondary">
        {{ t('consequences.cardRequiredMonetary') }}
      </p>
      <NuxtLink
        to="/app/reglages#paiement"
        class="mt-3 inline-flex text-sm font-semibold text-app-blue"
      >
        {{ t('consequences.configureCard') }}
      </NuxtLink>
    </div>

    <div v-if="isLoading" class="py-12 text-center text-sm text-app-secondary">
      {{ t('common.loading') }}
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

      <AppUiCard v-else :title="t('consequences.emptyTitle')">
        <p class="text-sm text-app-secondary">
          {{ t('consequences.emptyText') }}
        </p>
      </AppUiCard>

      <AppUiCard v-if="settingUpAccountability" class="mt-6" :title="t('accountability.setupTitle')">
        <p class="mb-4 text-sm text-app-secondary">{{ t('accountability.setupHint') }}</p>
        <AccountabilityContactForm
          :submit-label="t('accountability.sendInvitation')"
          :loading="createConsequence.isPending.value"
          cancellable
          @submit="handleAdd('accountability-message', $event)"
          @cancel="settingUpAccountability = false"
        />
      </AppUiCard>

      <ConsequenceTypePicker
        v-else
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
