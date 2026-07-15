<script setup lang="ts">
const props = withDefaults(defineProps<{
  name: string
  logoUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
}>(), {
  size: 'md',
})

const imageError = ref(false)

watch(() => props.logoUrl, () => {
  imageError.value = false
})

const showImage = computed(() => Boolean(props.logoUrl) && !imageError.value)

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'h-8 w-8'
  if (props.size === 'lg') return 'h-14 w-14'
  return 'h-10 w-10'
})

const fallbackInitial = computed(() => props.name.trim().charAt(0).toUpperCase() || '?')
</script>

<template>
  <div
    class="flex shrink-0 items-center justify-center overflow-hidden rounded-focus border border-focus-gray-100 bg-focus-gray-50"
    :class="sizeClass"
  >
    <img
      v-if="showImage"
      :src="logoUrl!"
      :alt="`Logo ${name}`"
      class="h-full w-full object-contain p-1"
      loading="lazy"
      @error="imageError = true"
    >
    <span
      v-else
      class="font-semibold text-focus-gray-400"
      :class="size === 'lg' ? 'text-lg' : 'text-sm'"
    >
      {{ fallbackInitial }}
    </span>
  </div>
</template>
