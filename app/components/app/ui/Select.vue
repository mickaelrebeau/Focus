<script setup lang="ts">
withDefaults(defineProps<{
  modelValue?: string
  label?: string
  required?: boolean
  error?: string
}>(), {
  modelValue: '',
  label: '',
  required: false,
  error: '',
})

defineEmits<{
  'update:modelValue': [value: string]
}>()

const selectId = useId()
</script>

<template>
  <div class="space-y-1.5">
    <label v-if="label" :for="selectId" class="text-sm font-semibold text-app-ink">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>
    <select
      :id="selectId"
      :value="modelValue"
      :required="required"
      class="app-input appearance-none bg-[length:1rem] bg-[right_0.9rem_center] bg-no-repeat pr-10"
      style="background-image: url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3E%3Cpath stroke=%27%23667085%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27m6 8 4 4 4-4%27/%3E%3C/svg%3E')"
      :class="{ '!border-red-300 !ring-red-100': error }"
      :aria-invalid="Boolean(error)"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <slot />
    </select>
    <p v-if="error" class="text-xs text-red-600">{{ error }}</p>
  </div>
</template>
