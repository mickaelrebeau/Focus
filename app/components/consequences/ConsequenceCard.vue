<script setup lang="ts">
import type { ConsequenceType, UserConsequence } from '~/composables/useConsequences'
import {
  centsToEuros,
  eurosToCents,
  formatEuroFromCents,
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
  if (isCreditsConsequenceType(props.consequence.type)) return 'Crédits'
  if (props.consequence.type === 'custom') return 'Montant'
  return 'Montant (€)'
})

const showAmount = computed(() =>
  !isBehaviorConsequenceType(props.consequence.type) && props.consequence.type !== 'custom',
)

const amountDisplay = computed(() => {
  if (isCreditsConsequenceType(props.consequence.type)) {
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
  <div class="app-sheet overflow-hidden">
    <div class="flex items-start gap-3 border-b border-app-line/60 p-4">
      <button
        type="button"
        class="drag-handle mt-1 cursor-grab touch-none text-lg text-slate-300 active:cursor-grabbing"
        aria-label="Réordonner"
      >
        ⋮⋮
      </button>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="flex h-8 w-8 items-center justify-center rounded-full bg-app-mist text-sm text-app-blue">
            {{ typeInfo?.icon ?? '◈' }}
          </span>
          <h3 class="text-sm font-semibold text-app-ink">
            {{ typeInfo?.name ?? consequence.type }}
          </h3>
          <AppUiBadge :variant="consequence.enabled ? 'success' : 'neutral'">
            {{ consequence.enabled ? 'Active' : 'Inactive' }}
          </AppUiBadge>
        </div>
        <p class="mt-1 text-xs text-app-secondary">
          {{ typeInfo?.description }}
        </p>
      </div>

      <div class="flex shrink-0 flex-col gap-1 sm:flex-row">
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-full text-app-secondary hover:bg-app-mist hover:text-app-ink disabled:opacity-30"
          :disabled="isFirst"
          aria-label="Monter"
          @click="emit('moveUp')"
        >
          ↑
        </button>
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-full text-app-secondary hover:bg-app-mist hover:text-app-ink disabled:opacity-30"
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
        class="rounded-app-control bg-app-mist px-4 py-3 text-sm"
      >
        <p class="font-semibold text-app-blue">Carte bancaire requise</p>
        <p class="mt-1 text-xs text-app-secondary">
          Cette conséquence nécessite une carte enregistrée dans vos réglages.
        </p>
        <NuxtLink
          to="/app/reglages#paiement"
          class="mt-2 inline-flex text-xs font-semibold text-app-blue"
        >
          Configurer ma carte →
        </NuxtLink>
      </div>

      <AppUiToggle
        :model-value="enabled"
        label="Activer cette conséquence"
        :description="`Priorité ${consequence.priority + 1}`"
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
          label="Association"
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
        label="Score net minimum du destinataire"
        type="number"
        :min="0"
        :step="1"
      />

      <AppUiInput
        v-if="consequence.type === 'custom'"
        v-model="customMessage"
        label="Message d'engagement"
        placeholder="Ex. Faire 100 pompes"
      />

      <p v-if="paymentError" class="text-sm text-red-500">{{ paymentError }}</p>

      <div
        v-if="estimate"
        class="rounded-app-control bg-app-canvas px-4 py-3 text-sm"
      >
        <p class="font-semibold text-app-ink">{{ estimate.label }}</p>
        <p class="mt-1 text-xs text-app-secondary">{{ estimate.description }}</p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <AppUiButton
          variant="secondary"
          :loading="saving"
          @click="saveChanges"
        >
          Enregistrer
        </AppUiButton>
        <AppUiButton
          v-if="consequence.type !== 'credits'"
          variant="ghost"
          class="text-red-500"
          @click="emit('remove')"
        >
          Supprimer
        </AppUiButton>
        <span class="text-xs text-app-secondary">
          Actuel : {{ amountDisplay }}
        </span>
      </div>
    </div>
  </div>
</template>
