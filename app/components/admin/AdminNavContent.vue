<script setup lang="ts">
withDefaults(defineProps<{
  items: { to: string, label: string }[]
  showLogo?: boolean
}>(), {
  showLogo: true,
})

const emit = defineEmits<{
  navigate: []
}>()
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div v-if="showLogo" class="flex h-16 shrink-0 items-center px-6">
      <AppLogo to="/admin" label="Focus Admin" variant="dark" />
    </div>
    <nav class="flex-1 space-y-1 overflow-y-auto px-4 py-4 lg:py-2">
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 rounded-focus px-3 py-2.5 text-sm font-medium text-focus-gray-300 transition hover:bg-focus-gray-800 hover:text-focus-white"
        active-class="!bg-focus-gray-800 !text-focus-white"
        @click="emit('navigate')"
      >
        {{ item.label }}
      </NuxtLink>
    </nav>
    <div class="shrink-0 border-t border-focus-gray-800 p-4">
      <NuxtLink
        to="/app"
        class="focus-btn-ghost w-full justify-start text-sm text-focus-gray-300"
        @click="emit('navigate')"
      >
        ← Retour à l'app
      </NuxtLink>
    </div>
  </div>
</template>
