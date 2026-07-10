<script setup lang="ts">
import { getTimezoneGroups } from '#shared/timezones'

defineProps<{
  modelValue?: string
  label?: string
  required?: boolean
  error?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()

const groups = getTimezoneGroups()
</script>

<template>
  <UiSelect
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
  </UiSelect>
</template>
