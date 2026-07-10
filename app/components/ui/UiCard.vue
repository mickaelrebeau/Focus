<script setup lang="ts">
defineProps<{
  title?: string
  padding?: boolean
}>()
</script>

<template>
  <div class="focus-card" :class="{ 'p-4': padding === false }">
    <h3 v-if="title" class="focus-heading-md mb-4">{{ title }}</h3>
    <slot />
  </div>
</template>
