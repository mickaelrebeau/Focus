<script setup lang="ts">
import type { ConsequenceType } from '~/composables/useConsequences'
import {
  isBehaviorConsequenceType,
  isCreditsConsequenceType,
  isMonetaryConsequenceType,
} from '~/composables/useConsequences'

const props = defineProps<{
  types: ConsequenceType[]
  configuredTypes: string[]
}>()

const emit = defineEmits<{
  add: [type: string]
}>()

const { t } = useI18n()
const { typeName, typeDescription } = useConsequenceText()

const availableTypes = computed(() =>
  props.types.filter(type => type.enabled && !props.configuredTypes.includes(type.key)),
)

function addType(type: ConsequenceType) {
  emit('add', type.key)
}

function formatDefaultAmount(type: string): string {
  if (isCreditsConsequenceType(type)) return t('consequences.defaults.credits')
  if (type === 'custom') return t('consequences.defaults.custom')
  if (isBehaviorConsequenceType(type)) return t('consequences.defaults.behavior')
  if (isMonetaryConsequenceType(type)) return t('consequences.defaults.monetary')
  return ''
}
</script>

<template>
  <AppUiCard v-if="availableTypes.length" :title="t('consequences.addTitle')">
    <div class="grid gap-3 sm:grid-cols-2">
      <button
        v-for="type in availableTypes"
        :key="type.key"
        type="button"
        class="flex min-h-11 items-start gap-3 rounded-app-control bg-app-canvas p-4 text-left transition hover:bg-app-mist active:scale-[0.99]"
        @click="addType(type)"
      >
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-lg text-app-blue">
          {{ type.icon }}
        </span>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-app-ink">{{ typeName(type.key, type) }}</p>
          <p class="mt-1 text-xs text-app-secondary">{{ typeDescription(type.key, type) }}</p>
          <p class="mt-2 text-xs font-semibold text-app-blue">
            {{ t('consequences.defaultValue', { value: formatDefaultAmount(type.key) }) }}
          </p>
        </div>
      </button>
    </div>
  </AppUiCard>
</template>
