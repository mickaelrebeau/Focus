<script setup lang="ts">
// Message à un proche : contact, message et consentement de l'utilisateur (premier opt-in).
// Le contact reçoit ensuite une invitation et doit accepter (second opt-in).
const props = withDefaults(defineProps<{
  initial?: Record<string, unknown>
  submitLabel: string
  loading?: boolean
  cancellable?: boolean
}>(), { initial: () => ({}), loading: false, cancellable: false })

const emit = defineEmits<{
  submit: [config: { contactEmail: string, contactName: string, message: string, userConsent: true }]
  cancel: []
}>()

const { t } = useI18n()

const contactEmail = ref(String(props.initial.contactEmail ?? ''))
const contactName = ref(String(props.initial.contactName ?? ''))
const message = ref(String(props.initial.message ?? t('accountability.defaultMessage')))
// Déjà donné si la conséquence existe : on le redemande seulement à la création
const consent = ref(props.initial.userConsent === true)

const canSubmit = computed(() => contactEmail.value.includes('@') && message.value.trim() && consent.value)

function submit() {
  if (!canSubmit.value) return
  emit('submit', {
    contactEmail: contactEmail.value.trim(),
    contactName: contactName.value.trim(),
    message: message.value.trim(),
    userConsent: true,
  })
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="submit">
    <AppUiInput v-model="contactEmail" :label="t('accountability.contactEmail')" type="email" required autocomplete="off" />
    <AppUiInput v-model="contactName" :label="t('accountability.contactName')" :placeholder="t('accountability.contactNamePlaceholder')" />
    <div class="space-y-1.5">
      <label for="accountability-message" class="text-sm font-semibold text-app-ink">{{ t('accountability.message') }}</label>
      <textarea id="accountability-message" v-model="message" class="app-input min-h-24" maxlength="500" required />
      <p class="text-xs text-app-secondary">{{ t('accountability.messageHint') }}</p>
    </div>
    <label class="flex items-start gap-3 rounded-app-control bg-app-canvas p-4 text-sm text-app-ink">
      <input v-model="consent" type="checkbox" class="mt-0.5 h-4 w-4 shrink-0 accent-app-ink">
      <span>{{ t('accountability.consent') }}</span>
    </label>
    <div class="flex flex-wrap items-center gap-3">
      <AppUiButton type="submit" variant="secondary" :disabled="!canSubmit" :loading="loading">{{ submitLabel }}</AppUiButton>
      <AppUiButton v-if="cancellable" variant="ghost" @click="emit('cancel')">{{ t('common.cancel') }}</AppUiButton>
    </div>
  </form>
</template>
