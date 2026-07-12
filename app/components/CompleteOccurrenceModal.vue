<script setup lang="ts">
import { compressImage, isAcceptedImageType, normalizeProofUrl } from '~/utils/proof'

const props = defineProps<{
  modelValue: boolean
  occurrenceId: string
  rewardCredits?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

const { completeOccurrence } = useOccurrences()

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
    error.value = 'Format non supporté. Utilisez JPEG, PNG ou WebP.'
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

    await completeOccurrence.mutateAsync({
      id: props.occurrenceId,
      note: note.value.trim() || undefined,
      proofType: imageProofUrl ? 'image' : normalizedUrl ? 'url' : undefined,
      proofUrl: imageProofUrl || normalizedUrl || undefined,
    })

    const { fetchUser } = useAuth()
    await fetchUser()
    close()
    emit('success')
  } catch (e: any) {
    error.value = e?.data?.message ?? e?.message ?? 'Impossible de valider l\'échéance'
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
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      @click.self="close"
    >
      <div class="w-full max-w-md rounded-focus-xl bg-focus-white p-6 shadow-focus-lg">
        <h3 class="focus-heading-md">Valider l'échéance</h3>
        <p class="focus-body-sm mt-2">Ajoutez une note, un lien ou une photo (facultatif).</p>

        <div class="mt-4 space-y-4">
          <UiInput v-model="note" label="Note" placeholder="Ce que j'ai accompli..." />

          <UiInput
            v-model="proofUrl"
            label="Lien de preuve"
            type="text"
            placeholder="https://... ou example.com"
          />

          <div class="space-y-2">
            <label class="text-sm font-medium text-focus-gray-700">Photo de preuve</label>
            <input
              ref="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              class="block w-full text-sm text-focus-gray-500 file:mr-3 file:rounded-focus file:border-0 file:bg-focus-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-focus-gray-700 hover:file:bg-focus-gray-200"
              @change="onImageSelected"
            >
            <p class="text-xs text-focus-gray-400">
              Facultatif. L'image sera compressée avant envoi.
            </p>
            <div v-if="proofImagePreview" class="relative overflow-hidden rounded-focus border border-focus-gray-200">
              <img :src="proofImagePreview" alt="Aperçu de la preuve" class="max-h-40 w-full object-cover">
              <button
                type="button"
                class="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white"
                @click="clearProofImage"
              >
                Retirer
              </button>
            </div>
          </div>
        </div>

        <p v-if="error" class="mt-4 text-sm text-red-500">{{ error }}</p>

        <div class="mt-6 flex gap-3">
          <UiButton variant="secondary" class="flex-1" :disabled="submitting" @click="close">
            Annuler
          </UiButton>
          <UiButton class="flex-1" :loading="submitting" @click="submit">
            Valider (+{{ rewardLabel }})
          </UiButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>
