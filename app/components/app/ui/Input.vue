<script setup lang="ts">
withDefaults(defineProps<{
  modelValue?: string | number
  type?: string
  placeholder?: string
  label?: string
  error?: string
  required?: boolean
  disabled?: boolean
  autocomplete?: string
  min?: string | number
  max?: string | number
  step?: string | number
}>(), {
  modelValue: '',
  type: 'text',
  placeholder: '',
  label: '',
  error: '',
  required: false,
  disabled: false,
  autocomplete: undefined,
  min: undefined,
  max: undefined,
  step: undefined,
})

defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputId = useId()
</script>

<template>
  <div class="space-y-1.5">
    <label v-if="label" :for="inputId" class="text-sm font-semibold text-app-ink">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>
    <input
      :id="inputId"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :autocomplete="autocomplete"
      :min="min"
      :max="max"
      :step="step"
      class="app-input"
      :class="{ '!border-red-300 !ring-red-100': error }"
      :aria-invalid="Boolean(error)"
      :aria-describedby="error ? `${inputId}-error` : undefined"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
    <p v-if="error" :id="`${inputId}-error`" class="text-xs text-red-600">{{ error }}</p>
  </div>
</template>
