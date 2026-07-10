<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent'
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  loading?: boolean
}>()

const variantClasses = {
  primary: 'focus-btn-primary',
  secondary: 'focus-btn-secondary',
  ghost: 'focus-btn-ghost',
  accent: 'focus-btn-accent',
}
</script>

<template>
  <button
    :type="type ?? 'button'"
    :disabled="disabled || loading"
    :class="variantClasses[variant ?? 'primary']"
  >
    <span v-if="loading" class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
    <slot />
  </button>
</template>
