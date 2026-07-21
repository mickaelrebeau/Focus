<script setup lang="ts">
import type { AppIconName } from '~/types/app-icon'

withDefaults(defineProps<{
  items: { to: string, label: string, icon: AppIconName }[]
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

const route = useRoute()

function isNavActive(to: string) {
  if (to === '/app') return route.path === '/app'
  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div v-if="showLogo" class="flex h-16 shrink-0 items-center px-6">
      <AppLogo to="/app" size="sm" />
    </div>
    <nav class="flex-1 space-y-1 overflow-y-auto px-3 py-4 lg:py-2">
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="app-sidebar-link"
        :class="{ 'app-sidebar-link-active': isNavActive(item.to) }"
        :aria-current="isNavActive(item.to) ? 'page' : undefined"
        @click="emit('navigate')"
      >
        <AppIcon :name="item.icon" class="h-5 w-5 shrink-0" />
        {{ item.label }}
      </NuxtLink>
    </nav>
    <div class="shrink-0 px-4 pb-5 pt-3">
      <div v-if="user" class="mb-3 rounded-app-control bg-app-canvas px-3 py-3">
        <p class="truncate text-sm font-semibold text-app-ink">{{ user.displayName }}</p>
        <p class="app-chip mt-2">{{ user.credits }} crédits</p>
      </div>
      <NuxtLink
        v-if="isAdmin"
        to="/admin"
        class="app-sidebar-link"
        @click="emit('navigate')"
      >
        Administration
      </NuxtLink>
    </div>
  </div>
</template>
