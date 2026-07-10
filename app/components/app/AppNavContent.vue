<script setup lang="ts">
withDefaults(defineProps<{
  items: { to: string, label: string, icon: string }[]
  user?: { displayName: string, credits: number } | null
  isAdmin?: boolean
  showLogo?: boolean
}>(), {
  user: null,
  isAdmin: false,
  showLogo: true,
})

const emit = defineEmits<{
  navigate: []
}>()
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div v-if="showLogo" class="flex h-16 shrink-0 items-center px-6">
      <AppLogo to="/app" size="sm" />
    </div>
    <nav class="flex-1 space-y-1 overflow-y-auto px-4 py-4 lg:py-2">
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 rounded-focus px-3 py-2.5 text-sm font-medium text-focus-gray-500 transition hover:bg-focus-gray-50 hover:text-focus-gray-900"
        active-class="!bg-focus-gray-100 !text-focus-gray-900"
        @click="emit('navigate')"
      >
        <span>{{ item.icon }}</span>
        {{ item.label }}
      </NuxtLink>
    </nav>
    <div class="shrink-0 border-t border-focus-gray-100 p-4">
      <div v-if="user" class="mb-3 px-2">
        <p class="truncate text-sm font-medium text-focus-gray-900">{{ user.displayName }}</p>
        <p class="text-xs text-focus-gray-400">{{ user.credits }} crédits</p>
      </div>
      <NuxtLink
        v-if="isAdmin"
        to="/admin"
        class="flex items-center gap-2 rounded-focus px-3 py-2 text-sm font-medium text-focus-gray-500 transition hover:bg-focus-gray-50 hover:text-focus-gray-900"
        @click="emit('navigate')"
      >
        ◆ Administration
      </NuxtLink>
    </div>
  </div>
</template>
