<script setup lang="ts">
withDefaults(defineProps<{
  modelValue: boolean
  label: string
  description?: string
  disabled?: boolean
}>(), {
  description: '',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <div
    class="flex items-start justify-between gap-4 rounded-app-control bg-app-canvas p-4"
    :class="{ 'opacity-50': disabled }"
  >
    <div class="min-w-0">
      <p class="text-sm font-semibold text-app-ink">{{ label }}</p>
      <p v-if="description" class="mt-1 text-xs leading-relaxed text-app-secondary">
        {{ description }}
      </p>
    </div>
    <button
      type="button"
      role="switch"
      :aria-label="label"
      :aria-checked="modelValue"
      :disabled="disabled"
      class="relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
      :class="modelValue ? 'bg-app-ink' : 'bg-slate-300'"
      @click="emit('update:modelValue', !modelValue)"
    >
      <span
        class="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition"
        :class="modelValue ? 'translate-x-5' : 'translate-x-0'"
      />
    </button>
  </div>
</template>
