<script setup lang="ts">
import type { ConsequenceType } from '~/composables/useConsequences'
import { isMonetaryConsequenceType } from '~/composables/useConsequences'

const props = defineProps<{
  types: ConsequenceType[]
  configuredTypes: string[]
}>()

const emit = defineEmits<{
  add: [type: string]
}>()

const availableTypes = computed(() =>
  props.types.filter(type => type.enabled && !props.configuredTypes.includes(type.key)),
)

function addType(type: ConsequenceType) {
  emit('add', type.key)
}

function formatDefaultAmount(type: string): string {
  if (type === 'credits') return '20 crédits'
  if (type === 'custom') return 'Rappel personnalisé'
  if (isMonetaryConsequenceType(type)) return '5 €'
  return ''
}
</script>

<template>
  <UiCard v-if="availableTypes.length" title="Ajouter une conséquence">
    <div class="grid gap-3 sm:grid-cols-2">
      <button
        v-for="type in availableTypes"
        :key="type.key"
        type="button"
        class="flex items-start gap-3 rounded-focus border border-focus-gray-200 p-4 text-left transition hover:border-focus-accent hover:bg-focus-gray-50"
        @click="addType(type)"
      >
        <span class="text-xl">{{ type.icon }}</span>
        <div class="min-w-0">
          <p class="text-sm font-medium text-focus-gray-900">{{ type.name }}</p>
          <p class="mt-1 text-xs text-focus-gray-400">{{ type.description }}</p>
          <p class="mt-2 text-xs font-medium text-focus-accent">
            Par défaut : {{ formatDefaultAmount(type.key) }}
          </p>
        </div>
      </button>
    </div>
  </UiCard>
</template>
