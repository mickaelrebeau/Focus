<script setup lang="ts">
import { loadStripe, type Stripe, type StripeElements } from '@stripe/stripe-js'

const props = defineProps<{
  paymentMethodLast4?: string
  paymentMethodBrand?: string
}>()

const emit = defineEmits<{
  saved: []
}>()

const runtimeConfig = useRuntimeConfig()
const showForm = ref(!props.paymentMethodLast4)
const loading = ref(false)
const error = ref('')
const paymentElementRef = ref<HTMLElement | null>(null)

let stripe: Stripe | null = null
let elements: StripeElements | null = null

const brandLabel = computed(() => {
  if (!props.paymentMethodBrand) return 'Carte'
  return props.paymentMethodBrand.charAt(0).toUpperCase() + props.paymentMethodBrand.slice(1)
})

async function mountPaymentElement() {
  if (!runtimeConfig.public.stripePublishableKey) {
    error.value = 'Stripe n\'est pas configuré (clé publique manquante)'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const { clientSecret } = await $fetch<{ clientSecret: string }>('/api/stripe/setup-intent', {
      method: 'POST',
      credentials: 'include',
    })

    stripe = await loadStripe(runtimeConfig.public.stripePublishableKey)
    if (!stripe) {
      throw new Error('Impossible de charger Stripe')
    }

    elements = stripe.elements({
      clientSecret,
      appearance: { theme: 'stripe' },
    })

    const paymentElement = elements.create('payment')
    await nextTick()

    if (!paymentElementRef.value) {
      throw new Error('Conteneur de paiement introuvable')
    }

    paymentElement.mount(paymentElementRef.value)
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string }, message?: string }
    error.value = fetchError?.data?.message ?? fetchError?.message ?? 'Erreur Stripe'
  } finally {
    loading.value = false
  }
}

async function savePaymentMethod() {
  if (!stripe || !elements) return

  loading.value = true
  error.value = ''

  try {
    const result = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: window.location.href,
      },
    })

    if (result.error) {
      error.value = result.error.message ?? 'Échec de l\'enregistrement de la carte'
      return
    }

    const paymentMethod = result.setupIntent?.payment_method
    const paymentMethodId = typeof paymentMethod === 'string'
      ? paymentMethod
      : paymentMethod?.id

    if (!paymentMethodId) {
      error.value = 'Moyen de paiement introuvable après confirmation'
      return
    }

    await $fetch('/api/stripe/confirm-setup', {
      method: 'POST',
      body: { paymentMethodId },
      credentials: 'include',
    })

    showForm.value = false
    emit('saved')
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string }, message?: string }
    error.value = fetchError?.data?.message ?? fetchError?.message ?? 'Erreur Stripe'
  } finally {
    loading.value = false
  }
}

async function changeCard() {
  showForm.value = true
  await nextTick()
  await mountPaymentElement()
}

watch(() => props.paymentMethodLast4, (value) => {
  if (value) {
    showForm.value = false
  }
})

onMounted(async () => {
  if (showForm.value) {
    await mountPaymentElement()
  }
})
</script>

<template>
  <div class="space-y-3 rounded-focus border border-focus-gray-200 p-4">
    <p class="text-sm font-medium text-focus-gray-900">Carte bancaire</p>

    <div
      v-if="!showForm && paymentMethodLast4"
      class="flex flex-wrap items-center justify-between gap-3"
    >
      <p class="text-sm text-focus-gray-600">
        {{ brandLabel }} •••• {{ paymentMethodLast4 }}
      </p>
      <UiButton variant="secondary" @click="changeCard">
        Changer de carte
      </UiButton>
    </div>

    <template v-else>
      <p class="text-xs text-focus-gray-500">
        Enregistrez une carte pour autoriser les prélèvements automatiques en cas d'échec.
      </p>
      <div ref="paymentElementRef" class="min-h-[120px]" />
      <UiButton :loading="loading" @click="savePaymentMethod">
        Enregistrer la carte
      </UiButton>
    </template>

    <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
  </div>
</template>
