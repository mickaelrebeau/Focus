<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue'
import { consequenceIcon } from '~/utils/consequence-icons'
import AccountabilityContactForm from '~/components/consequences/AccountabilityContactForm.vue'
import type { ConsequenceType, UserConsequence } from '~/composables/useConsequences'
import {
  centsToEuros,
  eurosToCents,
  isMonetaryConsequenceType,
  isCreditsConsequenceType,
  isBehaviorConsequenceType,
} from '~/composables/useConsequences'

const props = defineProps<{
  consequence: UserConsequence
  typeInfo?: ConsequenceType
  estimate?: { label: string, description: string } | null
  saving?: boolean
  isFirst?: boolean
  isLast?: boolean
}>()

const emit = defineEmits<{
  update: [payload: {
    enabled?: boolean
    amount?: number
    config?: Record<string, unknown>
  }]
  remove: []
  moveUp: []
  moveDown: []
}>()

const { user } = useAuth()
const { t } = useI18n()
const { typeName, typeDescription, estimate: localizeEstimate, formatAmount } = useConsequenceText()
const { data: associationsData } = await useFetch('/api/associations', {
  credentials: 'include',
})

const donationAssociations = computed(() => associationsData.value?.associations ?? [])

const enabled = ref(props.consequence.enabled)
const amountEuros = ref(
  isMonetaryConsequenceType(props.consequence.type)
    ? centsToEuros(props.consequence.amount)
    : props.consequence.amount,
)
const association = ref(String(props.consequence.config.association ?? donationAssociations.value[0]?.value ?? ''))
const minimumScore = ref(Number(props.consequence.config.minimumScore ?? 0))
const customMessage = ref(String(props.consequence.config.message ?? ''))
const paymentError = ref('')

const selectedAssociation = computed(() =>
  donationAssociations.value.find(item => item.value === association.value),
)

// L'estimation décrit la configuration enregistrée, pas celle en cours d'édition
const displayedEstimate = computed(() => {
  const savedAssociation = donationAssociations.value.find(item => item.value === props.consequence.config.association)
  return localizeEstimate(props.consequence, props.estimate, savedAssociation?.label)
})
const hasPaymentMethod = computed(() => Boolean(user.value?.hasPaymentMethod))
const requiresPaymentMethod = computed(() =>
  isMonetaryConsequenceType(props.consequence.type),
)

watch(donationAssociations, (items) => {
  if (props.consequence.type === 'donation' && !association.value && items[0]) {
    association.value = items[0].value
  }
}, { immediate: true })

watch(() => props.consequence, (value) => {
  enabled.value = value.enabled
  amountEuros.value = isMonetaryConsequenceType(value.type)
    ? centsToEuros(value.amount)
    : value.amount
  association.value = String(value.config.association ?? donationAssociations.value[0]?.value ?? '')
  minimumScore.value = Number(value.config.minimumScore ?? 0)
  customMessage.value = String(value.config.message ?? '')
}, { deep: true })

const amountLabel = computed(() => {
  if (isCreditsConsequenceType(props.consequence.type)) return t('consequences.amountCredits')
  if (props.consequence.type === 'custom') return t('consequences.amount')
  return t('consequences.amountEuros')
})

const showAmount = computed(() =>
  !isBehaviorConsequenceType(props.consequence.type) && props.consequence.type !== 'custom',
)

const amountDisplay = computed(() => {
  if (isCreditsConsequenceType(props.consequence.type)) {
    return t('common.credits', props.consequence.amount)
  }
  if (isMonetaryConsequenceType(props.consequence.type)) {
    return formatAmount(props.consequence.amount)
  }
  return '—'
})

function buildPayload() {
  const amount = isMonetaryConsequenceType(props.consequence.type)
    ? eurosToCents(amountEuros.value)
    : Math.round(amountEuros.value)

  const config: Record<string, unknown> = {}

  if (props.consequence.type === 'donation') {
    config.association = association.value
  }
  if (props.consequence.type === 'random-user') {
    config.minimumScore = minimumScore.value
  }
  if (props.consequence.type === 'custom') {
    config.message = customMessage.value
  }

  return {
    enabled: enabled.value,
    amount,
    config,
  }
}

function saveChanges() {
  emit('update', buildPayload())
}

function onToggle(value: boolean) {
  if (requiresPaymentMethod.value && value && !hasPaymentMethod.value) {
    paymentError.value = t('consequences.errors.cardFirst')
    enabled.value = false
    return
  }

  paymentError.value = ''
  enabled.value = value
  emit('update', { enabled: value })
}
</script>

<template>
  <div class="app-sheet overflow-hidden">
    <div class="flex items-start gap-3 border-b border-app-line/60 p-4">
      <button
        type="button"
        class="drag-handle mt-1 cursor-grab touch-none text-lg text-slate-300 active:cursor-grabbing"
        :aria-label="t('consequences.reorder')"
      >
        ⋮⋮
      </button>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="flex h-8 w-8 items-center justify-center rounded-full bg-app-mist text-sm text-app-blue">
            <HugeiconsIcon :icon="consequenceIcon(consequence.type)" :size="16" :stroke-width="1.8" aria-hidden="true" />
          </span>
          <h3 class="text-sm font-semibold text-app-ink">
            {{ typeName(consequence.type, typeInfo) }}
          </h3>
          <AppUiBadge :variant="consequence.enabled ? 'success' : 'neutral'">
            {{ consequence.enabled ? t('consequences.active') : t('consequences.inactive') }}
          </AppUiBadge>
        </div>
        <p class="mt-1 text-xs text-app-secondary">
          {{ typeDescription(consequence.type, typeInfo) }}
        </p>
      </div>

      <div class="flex shrink-0 flex-col gap-1 sm:flex-row">
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-full text-app-secondary hover:bg-app-mist hover:text-app-ink disabled:opacity-30"
          :disabled="isFirst"
          :aria-label="t('consequences.moveUp')"
          @click="emit('moveUp')"
        >
          ↑
        </button>
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-full text-app-secondary hover:bg-app-mist hover:text-app-ink disabled:opacity-30"
          :disabled="isLast"
          :aria-label="t('consequences.moveDown')"
          @click="emit('moveDown')"
        >
          ↓
        </button>
      </div>
    </div>

    <div class="space-y-4 p-4">
      <div
        v-if="requiresPaymentMethod && !hasPaymentMethod"
        class="rounded-app-control bg-app-mist px-4 py-3 text-sm"
      >
        <p class="font-semibold text-app-blue">{{ t('consequences.cardRequired') }}</p>
        <p class="mt-1 text-xs text-app-secondary">
          {{ t('consequences.cardRequiredThis') }}
        </p>
        <NuxtLink
          to="/app/reglages#paiement"
          class="mt-2 inline-flex text-xs font-semibold text-app-blue"
        >
          {{ t('consequences.configureCard') }}
        </NuxtLink>
      </div>

      <AppUiToggle
        :model-value="enabled"
        :label="t('consequences.enable')"
        :description="t('consequences.priority', { n: consequence.priority + 1 })"
        @update:model-value="onToggle"
      />

      <AppUiInput
        v-if="showAmount"
        v-model.number="amountEuros"
        :label="amountLabel"
        type="number"
        :min="isCreditsConsequenceType(consequence.type) ? 1 : 1"
        :step="isCreditsConsequenceType(consequence.type) ? 1 : 0.5"
      />

      <div v-if="consequence.type === 'donation'" class="space-y-3">
        <AppUiSelect
          v-model="association"
          :label="t('consequences.association')"
        >
          <option
            v-for="item in donationAssociations"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </option>
        </AppUiSelect>

        <div
          v-if="selectedAssociation"
          class="flex items-center gap-3 rounded-app-control bg-app-canvas px-3 py-2"
        >
          <AssociationLogo
            :name="selectedAssociation.label"
            :logo-url="selectedAssociation.logoUrl"
            size="sm"
          />
          <div class="min-w-0">
            <p class="text-sm font-semibold text-app-ink">{{ selectedAssociation.label }}</p>
            <p
              v-if="selectedAssociation.description"
              class="truncate text-xs text-app-secondary"
            >
              {{ selectedAssociation.description }}
            </p>
          </div>
        </div>
      </div>

      <AppUiInput
        v-if="consequence.type === 'random-user'"
        v-model.number="minimumScore"
        :label="t('consequences.minimumScore')"
        type="number"
        :min="0"
        :step="1"
      />

      <div v-if="consequence.type === 'accountability-message'" class="space-y-4">
        <p class="rounded-app-control bg-app-canvas px-4 py-3 text-sm" data-testid="contact-status">
          <span class="font-semibold text-app-ink">{{ t(`accountability.status.${consequence.contact?.status ?? 'pending'}`) }}</span>
          <span class="mt-1 block text-xs text-app-secondary">{{ t(`accountability.statusHint.${consequence.contact?.status ?? 'pending'}`) }}</span>
        </p>
        <AccountabilityContactForm
          :initial="consequence.config"
          :submit-label="t('common.save')"
          :loading="saving"
          @submit="emit('update', { enabled, config: $event })"
        />
      </div>

      <AppUiInput
        v-if="consequence.type === 'custom'"
        v-model="customMessage"
        :label="t('consequences.customMessage')"
        :placeholder="t('consequences.customMessagePlaceholder')"
      />

      <p v-if="paymentError" class="text-sm text-red-500">{{ paymentError }}</p>

      <div
        v-if="displayedEstimate"
        class="rounded-app-control bg-app-canvas px-4 py-3 text-sm"
      >
        <p class="font-semibold text-app-ink">{{ displayedEstimate.label }}</p>
        <p class="mt-1 text-xs text-app-secondary">{{ displayedEstimate.description }}</p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <AppUiButton
          v-if="consequence.type !== 'accountability-message'"
          variant="secondary"
          :loading="saving"
          @click="saveChanges"
        >
          {{ t('common.save') }}
        </AppUiButton>
        <AppUiButton
          v-if="consequence.type !== 'credits'"
          variant="ghost"
          class="text-red-500"
          @click="emit('remove')"
        >
          {{ t('common.delete') }}
        </AppUiButton>
        <span class="text-xs text-app-secondary">
          {{ t('consequences.current', { value: amountDisplay }) }}
        </span>
      </div>
    </div>
  </div>
</template>
