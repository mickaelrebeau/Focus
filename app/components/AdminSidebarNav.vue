<script setup lang="ts">
defineProps<{
  items: { to: string, label: string }[]
}>()

const emit = defineEmits<{
  navigate: []
}>()
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="hidden h-16 items-center px-6 lg:flex">
      <AppLogo to="/admin" label="Focus Admin" variant="dark" />
    </div>
    <nav class="space-y-1 px-4 py-4 lg:py-0">
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
    <div class="mt-auto border-t border-focus-gray-800 p-4">
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
