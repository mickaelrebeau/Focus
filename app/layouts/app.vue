<template>
  <div class="min-h-dvh bg-focus-gray-50">
    <!-- Desktop sidebar -->
    <aside class="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-focus-gray-200 bg-focus-white lg:block">
      <div class="flex h-16 items-center px-6">
        <AppLogo to="/app" size="sm" />
      </div>
      <nav class="space-y-1 px-4">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-focus px-3 py-2.5 text-sm font-medium text-focus-gray-500 transition hover:bg-focus-gray-50 hover:text-focus-gray-900"
          active-class="!bg-focus-gray-100 !text-focus-gray-900"
        >
          <span>{{ item.icon }}</span>
          {{ item.label }}
        </NuxtLink>
      </nav>
      <div class="absolute bottom-0 left-0 right-0 border-t border-focus-gray-100 p-4">
        <div v-if="user" class="mb-3 px-2">
          <p class="truncate text-sm font-medium text-focus-gray-900">{{ user.displayName }}</p>
          <p class="text-xs text-focus-gray-400">{{ user.credits }} crédits</p>
        </div>
        <NuxtLink
          v-if="isAdmin"
          to="/admin"
          class="flex items-center gap-2 rounded-focus px-3 py-2 text-sm font-medium text-focus-gray-500 transition hover:bg-focus-gray-50 hover:text-focus-gray-900"
        >
          ◆ Administration
        </NuxtLink>
      </div>
    </aside>

    <!-- Mobile header -->
    <header class="sticky top-0 z-30 border-b border-focus-gray-200 bg-focus-white/90 backdrop-blur-xl pt-safe lg:hidden">
      <div class="flex h-14 items-center justify-between px-5">
        <AppLogo to="/app" :show-label="false" size="md" />
        <div class="flex items-center gap-3">
          <NuxtLink
            v-if="isAdmin"
            to="/admin"
            class="text-xs font-medium text-focus-gray-500"
          >
            Admin
          </NuxtLink>
          <div v-if="user" class="flex items-center gap-2 border border-focus-gray-200 rounded-focus px-2 py-1">
            <p class="text-sm font-semibold text-focus-gray-900">
              <span class="text-xs">{{ user.credits }}</span>
              <span class="ml-2 text-xs">crédits</span>
            </p>
          </div>
        </div>
      </div>
    </header>

    <main class="lg:pl-64">
      <div class="pb-24 lg:pb-8">
        <slot />
      </div>
    </main>

    <!-- Mobile bottom nav -->
    <nav class="fixed bottom-0 left-0 right-0 z-30 border-t border-focus-gray-200 bg-focus-white/95 backdrop-blur-xl pb-safe lg:hidden">
      <div class="flex items-center justify-around py-1">
        <NuxtLink
          v-for="item in mobileNavItems"
          :key="item.to"
          :to="item.to"
          class="focus-nav-item"
          active-class="focus-nav-item-active"
        >
          <span class="text-lg">{{ item.icon }}</span>
          {{ item.label }}
        </NuxtLink>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
const { user, logout, isAdmin } = useAuth()

const navItems = [
  { to: '/app', label: 'Aujourd\'hui', icon: '◎' },
  { to: '/app/objectifs', label: 'Objectifs', icon: '◈' },
  { to: '/app/agenda', label: 'Agenda', icon: '◷' },
  { to: '/app/classement', label: 'Classement', icon: '▲' },
  { to: '/app/historique', label: 'Historique', icon: '◫' },
  { to: '/app/reglages', label: 'Réglages', icon: '◉' },
]

const mobileNavItems = [
  { to: '/app', label: 'Aujourd\'hui', icon: '◎' },
  { to: '/app/objectifs', label: 'Objectifs', icon: '◈' },
  { to: '/app/agenda', label: 'Agenda', icon: '◷' },
  { to: '/app/historique', label: 'Historique', icon: '◫' },
]
</script>
