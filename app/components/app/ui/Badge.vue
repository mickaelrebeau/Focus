<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'success' | 'warning' | 'danger' | 'neutral'
}>(), {
  variant: 'neutral',
})

const classes = {
  success: 'app-badge-success',
  warning: 'app-badge-warning',
  danger: 'app-badge-danger',
  neutral: 'app-badge-neutral',
}
</script>

<template>
  <span :class="classes[variant]">
    <slot />
  </span>
</template>
