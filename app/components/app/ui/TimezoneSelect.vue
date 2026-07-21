<script setup lang="ts">
import { getTimezoneGroups } from '#shared/timezones'

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

const groups = getTimezoneGroups()
</script>

<template>
  <AppUiSelect
    :model-value="modelValue"
    :label="label"
    :required="required"
    :error="error"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <optgroup v-for="[name, options] in groups" :key="name" :label="name">
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </optgroup>
  </AppUiSelect>
</template>
