<script setup lang="ts">
withDefaults(defineProps<{
  to?: string
  showLabel?: boolean
  label?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'light' | 'dark'
}>(), {
  to: '/',
  showLabel: true,
  label: 'Focus',
  size: 'md',
  variant: 'light',
})

const sizeClasses = {
  sm: 'h-7 w-[31px]',
  md: 'h-8 w-[36px]',
  lg: 'h-10 w-[45px]',
}

const labelClasses = {
  light: 'text-focus-gray-900',
  dark: 'text-focus-white',
}
</script>

<template>
  <NuxtLink :to="to" class="inline-flex items-center gap-2.5 transition opacity-100 hover:opacity-80">
    <img
      src="/logo.svg"
      :alt="label"
      :class="sizeClasses[size]"
      class="shrink-0 rounded-md"
      width="36"
      height="32"
    >
    <span
      v-if="showLabel"
      class="text-lg font-semibold tracking-tight"
      :class="labelClasses[variant]"
    >
      {{ label }}
    </span>
  </NuxtLink>
</template>
