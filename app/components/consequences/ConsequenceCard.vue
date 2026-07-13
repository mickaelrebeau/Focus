<script setup lang="ts">
import type { ConsequenceType, UserConsequence } from '~/composables/useConsequences'
import { DONATION_ASSOCIATIONS } from '#shared/donation-associations'
import {
  centsToEuros,
  eurosToCents,
  formatEuroFromCents,
  isMonetaryConsequenceType,
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

const enabled = ref(props.consequence.enabled)
const amountEuros = ref(
  isMonetaryConsequenceType(props.consequence.type)
    ? centsToEuros(props.consequence.amount)
    : props.consequence.amount,
)
const association = ref(String(props.consequence.config.association ?? 'wwf'))
const minimumScore = ref(Number(props.consequence.config.minimumScore ?? 0))
const customMessage = ref(String(props.consequence.config.message ?? ''))
const paymentError = ref('')

const hasPaymentMethod = computed(() => Boolean(user.value?.hasPaymentMethod))
const requiresPaymentMethod = computed(() =>
  isMonetaryConsequenceType(props.consequence.type),
)

watch(() => props.consequence, (value) => {
  enabled.value = value.enabled
  amountEuros.value = isMonetaryConsequenceType(value.type)
    ? centsToEuros(value.amount)
    : value.amount
  association.value = String(value.config.association ?? 'wwf')
  minimumScore.value = Number(value.config.minimumScore ?? 0)
  customMessage.value = String(value.config.message ?? '')
}, { deep: true })

const amountLabel = computed(() => {
  if (props.consequence.type === 'credits') return 'Crédits'
  if (props.consequence.type === 'custom') return 'Montant'
  return 'Montant (€)'
})

const showAmount = computed(() => props.consequence.type !== 'custom')

const amountDisplay = computed(() => {
  if (props.consequence.type === 'credits') {
    return `${props.consequence.amount} crédits`
  }
  if (isMonetaryConsequenceType(props.consequence.type)) {
    return formatEuroFromCents(props.consequence.amount)
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
    paymentError.value = 'Configurez d\'abord une carte bancaire dans vos réglages'
    enabled.value = false
    return
  }

  paymentError.value = ''
  enabled.value = value
  emit('update', { enabled: value })
}
</script>

<template>
  <div class="rounded-focus border border-focus-gray-200 bg-white">
    <div class="flex items-start gap-3 border-b border-focus-gray-100 p-4">
      <button
        type="button"
        class="drag-handle mt-1 cursor-grab touch-none text-lg text-focus-gray-300 active:cursor-grabbing"
        aria-label="Réordonner"
      >
        ⋮⋮
      </button>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-lg">{{ typeInfo?.icon ?? '◈' }}</span>
          <h3 class="text-sm font-semibold text-focus-gray-900">
            {{ typeInfo?.name ?? consequence.type }}
          </h3>
          <UiBadge :variant="consequence.enabled ? 'success' : 'neutral'">
            {{ consequence.enabled ? 'Active' : 'Inactive' }}
          </UiBadge>
        </div>
        <p class="mt-1 text-xs text-focus-gray-400">
          {{ typeInfo?.description }}
        </p>
      </div>

      <div class="flex shrink-0 flex-col gap-1 sm:flex-row">
        <button
          type="button"
          class="rounded-focus px-2 py-1 text-xs text-focus-gray-400 hover:bg-focus-gray-50 hover:text-focus-gray-700 disabled:opacity-30"
          :disabled="isFirst"
          aria-label="Monter"
          @click="emit('moveUp')"
        >
          ↑
        </button>
        <button
          type="button"
          class="rounded-focus px-2 py-1 text-xs text-focus-gray-400 hover:bg-focus-gray-50 hover:text-focus-gray-700 disabled:opacity-30"
          :disabled="isLast"
          aria-label="Descendre"
          @click="emit('moveDown')"
        >
          ↓
        </button>
      </div>
    </div>

    <div class="space-y-4 p-4">
      <div
        v-if="requiresPaymentMethod && !hasPaymentMethod"
        class="rounded-focus border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        <p class="font-medium">Carte bancaire requise</p>
        <p class="mt-1 text-xs text-amber-800">
          Cette conséquence nécessite une carte enregistrée dans vos réglages.
        </p>
        <NuxtLink
          to="/app/reglages#paiement"
          class="mt-2 inline-flex text-xs font-medium text-focus-accent hover:opacity-80"
        >
          Configurer ma carte →
        </NuxtLink>
      </div>

      <UiToggle
        :model-value="enabled"
        label="Activer cette conséquence"
        :description="`Priorité ${consequence.priority + 1}`"
        @update:model-value="onToggle"
      />

      <UiInput
        v-if="showAmount"
        v-model.number="amountEuros"
        :label="amountLabel"
        type="number"
        :min="consequence.type === 'credits' ? 1 : 1"
        :step="consequence.type === 'credits' ? 1 : 0.5"
      />

      <UiSelect
        v-if="consequence.type === 'donation'"
        v-model="association"
        label="Association"
      >
        <option
          v-for="item in DONATION_ASSOCIATIONS"
          :key="item.value"
          :value="item.value"
        >
          {{ item.label }}
        </option>
      </UiSelect>

      <UiInput
        v-if="consequence.type === 'random-user'"
        v-model.number="minimumScore"
        label="Score net minimum du destinataire"
        type="number"
        :min="0"
        :step="1"
      />

      <UiInput
        v-if="consequence.type === 'custom'"
        v-model="customMessage"
        label="Message d'engagement"
        placeholder="Ex. Faire 100 pompes"
      />

      <p v-if="paymentError" class="text-sm text-red-500">{{ paymentError }}</p>

      <div
        v-if="estimate"
        class="rounded-focus bg-focus-gray-50 px-4 py-3 text-sm"
      >
        <p class="font-medium text-focus-gray-900">{{ estimate.label }}</p>
        <p class="mt-1 text-xs text-focus-gray-500">{{ estimate.description }}</p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <UiButton
          variant="secondary"
          :loading="saving"
          @click="saveChanges"
        >
          Enregistrer
        </UiButton>
        <UiButton
          v-if="consequence.type !== 'credits'"
          variant="ghost"
          class="text-red-500"
          @click="emit('remove')"
        >
          Supprimer
        </UiButton>
        <span class="text-xs text-focus-gray-400">
          Actuel : {{ amountDisplay }}
        </span>
      </div>
    </div>
  </div>
</template>
