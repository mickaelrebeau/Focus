<script setup lang="ts">
defineProps<{
  variant?: 'success' | 'warning' | 'danger' | 'neutral'
}>()

const classes = {
  success: 'focus-badge-success',
  warning: 'focus-badge-warning',
  danger: 'focus-badge-danger',
  neutral: 'focus-badge-neutral',
}
</script>

<template>
  <span :class="classes[variant ?? 'neutral']">
    <slot />
  </span>
</template>
