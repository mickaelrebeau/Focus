<script setup lang="ts">
defineProps<{
  modelValue: boolean
  label: string
  description?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <label
    class="flex cursor-pointer items-start justify-between gap-4 rounded-focus border border-focus-gray-200 p-4 transition hover:border-focus-gray-300"
    :class="{ 'opacity-50': disabled }"
  >
    <div class="min-w-0">
      <p class="text-sm font-medium text-focus-gray-900">{{ label }}</p>
      <p v-if="description" class="mt-1 text-xs leading-relaxed text-focus-gray-400">
        {{ description }}
      </p>
    </div>
    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :disabled="disabled"
      class="relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition"
      :class="modelValue ? 'bg-focus-black' : 'bg-focus-gray-200'"
      @click.prevent="emit('update:modelValue', !modelValue)"
    >
      <span
        class="absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition"
        :class="modelValue ? 'translate-x-5' : 'translate-x-0'"
      />
    </button>
  </label>
</template>
