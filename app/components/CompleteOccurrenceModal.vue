<script setup lang="ts">
import { compressImage, isAcceptedImageType, normalizeProofUrl } from '~/utils/proof'

const props = defineProps<{
  modelValue: boolean
  occurrenceId: string
  rewardCredits?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: [payload: { streak: any }]
}>()

const { completeOccurrence } = useOccurrences()
const isOnline = useOnline()
const { t } = useI18n()

const note = ref('')
const proofUrl = ref('')
const proofImage = ref<File | null>(null)
const proofImagePreview = ref<string | null>(null)
const submitting = ref(false)
const error = ref('')

const fileInput = ref<HTMLInputElement | null>(null)

const rewardLabel = computed(() => props.rewardCredits ?? 10)

watch(() => props.modelValue, (open) => {
  if (open) {
    note.value = ''
    proofUrl.value = ''
    clearProofImage()
    error.value = ''
    submitting.value = false
  }
})

function close() {
  emit('update:modelValue', false)
}

function clearProofImage() {
  if (proofImagePreview.value) {
    URL.revokeObjectURL(proofImagePreview.value)
  }
  proofImage.value = null
  proofImagePreview.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function onImageSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!isAcceptedImageType(file.type)) {
    error.value = t('complete.errors.unsupportedImage')
    input.value = ''
    return
  }

  clearProofImage()
  proofImage.value = file
  proofImagePreview.value = URL.createObjectURL(file)
  error.value = ''
}

async function submit() {
  if (!props.occurrenceId || submitting.value) return

  if (!isOnline.value) {
    error.value = t('complete.errors.offline')
    return
  }

  submitting.value = true
  error.value = ''

  try {
    let imageProofUrl: string | undefined

    if (proofImage.value) {
      const compressed = await compressImage(proofImage.value)
      const formData = new FormData()
      formData.append('file', compressed, 'proof.jpg')

      const upload = await $fetch<{ url: string }>('/api/uploads/proof', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      imageProofUrl = upload.url
    }

    const normalizedUrl = normalizeProofUrl(proofUrl.value)

    const result = await completeOccurrence.mutateAsync({
      id: props.occurrenceId,
      note: note.value.trim() || undefined,
      proofType: imageProofUrl ? 'image' : normalizedUrl ? 'url' : undefined,
      proofUrl: imageProofUrl || normalizedUrl || undefined,
    })

    const { fetchUser } = useAuth()
    await fetchUser()
    close()
    emit('success', { streak: result.streak ?? null })
  } catch (e: any) {
    error.value = e?.data?.message ?? e?.message ?? t('complete.errors.failed')
  } finally {
    submitting.value = false
  }
}

onBeforeUnmount(() => {
  clearProofImage()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="app-overlay fixed inset-0 z-50 flex items-end justify-center bg-slate-950/25 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      @click.self="close"
      @keydown.esc="close"
    >
      <div
        class="w-full max-w-md animate-slide-up rounded-t-[28px] bg-white p-6 pb-safe shadow-app-soft sm:rounded-app-card sm:pb-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-title"
      >
        <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-app-line sm:hidden" />
        <h2 id="complete-title" class="text-xl font-semibold tracking-tight text-app-ink">{{ t('complete.title') }}</h2>
        <p class="mt-1 text-sm text-app-secondary">{{ t('complete.subtitle') }}</p>

        <div class="mt-5 space-y-4">
          <AppUiInput v-model="note" :label="t('complete.noteLabel')" :placeholder="t('complete.notePlaceholder')" />

          <AppUiInput
            v-model="proofUrl"
            :label="t('complete.proofUrlLabel')"
            type="text"
            :placeholder="t('complete.proofUrlPlaceholder')"
          />

          <div class="space-y-2">
            <label class="text-sm font-semibold text-app-ink">{{ t('complete.proofPhotoLabel') }}</label>
            <input
              ref="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              class="block w-full text-sm text-app-secondary file:mr-3 file:rounded-full file:border-0 file:bg-app-mist file:px-4 file:py-2 file:text-sm file:font-semibold file:text-app-blue hover:file:bg-app-muted/40"
              @change="onImageSelected"
            >
            <p class="text-xs text-app-secondary">
              {{ t('complete.proofPhotoHint') }}
            </p>
            <div v-if="proofImagePreview" class="relative overflow-hidden rounded-app-control">
              <img :src="proofImagePreview" :alt="t('complete.proofPreviewAlt')" class="max-h-40 w-full object-cover">
              <button
                type="button"
                class="absolute right-2 top-2 rounded-full bg-slate-950/60 px-3 py-1 text-xs text-white"
                @click="clearProofImage"
              >
                {{ t('complete.removePhoto') }}
              </button>
            </div>
          </div>
        </div>

        <p v-if="!isOnline && !error" class="mt-4 text-sm text-amber-700">
          {{ t('complete.offlineHint') }}
        </p>
        <p v-if="error" class="mt-4 text-sm text-red-500">{{ error }}</p>

        <div class="mt-6 flex gap-3">
          <AppUiButton variant="secondary" class="flex-1" :disabled="submitting" @click="close">
            {{ t('common.cancel') }}
          </AppUiButton>
          <AppUiButton class="flex-1" :loading="submitting" :disabled="!isOnline" @click="submit">
            {{ t('complete.submit', { reward: rewardLabel }) }}
          </AppUiButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>
