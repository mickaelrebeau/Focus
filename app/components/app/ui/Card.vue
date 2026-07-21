<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  padding?: boolean
}>(), {
  title: '',
  padding: true,
})
</script>

<template>
  <section class="app-sheet" :class="padding ? 'p-5 md:p-6' : ''">
    <h2 v-if="title" class="app-section-title mb-4">{{ title }}</h2>
    <slot />
  </section>
</template>
