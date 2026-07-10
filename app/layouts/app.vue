<template>
  <div class="min-h-dvh bg-focus-gray-50">
    <!-- Desktop sidebar -->
    <aside class="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-focus-gray-200 bg-focus-white lg:flex">
      <AppNavContent
        :items="navItems"
        :user="user"
        :is-admin="isAdmin"
      />
    </aside>

    <!-- Mobile drawer -->
    <Teleport to="body">
      <div
        v-if="menuOpen"
        class="fixed inset-0 z-50 lg:hidden"
      >
        <button
          type="button"
          class="absolute inset-0 bg-black/40"
          aria-label="Fermer le menu"
          @click="menuOpen = false"
        />
        <aside class="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-focus-gray-200 bg-focus-white shadow-focus-lg">
          <div class="flex h-14 shrink-0 items-center justify-between border-b border-focus-gray-100 px-5">
            <AppLogo to="/app" size="sm" />
            <button
              type="button"
              class="flex h-10 w-10 items-center justify-center rounded-focus text-focus-gray-500 transition hover:bg-focus-gray-50 hover:text-focus-gray-900"
              aria-label="Fermer le menu"
              @click="menuOpen = false"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <AppNavContent
            :items="navItems"
            :user="user"
            :is-admin="isAdmin"
            :show-logo="false"
            class="min-h-0 flex-1"
            @navigate="menuOpen = false"
          />
        </aside>
      </div>
    </Teleport>

    <!-- Mobile header -->
    <header class="sticky top-0 z-30 border-b border-focus-gray-200 bg-focus-white/90 backdrop-blur-xl pt-safe lg:hidden">
      <div class="flex h-14 items-center justify-between gap-3 px-5">
        <div class="flex min-w-0 items-center gap-3">
          <button
            type="button"
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-focus border border-focus-gray-200 text-focus-gray-700 transition hover:bg-focus-gray-50"
            aria-label="Ouvrir le menu"
            @click="menuOpen = true"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <AppLogo to="/app" :show-label="false" size="md" />
        </div>
        <div class="flex shrink-0 items-center gap-3">
          <NuxtLink
            v-if="isAdmin"
            to="/admin"
            class="text-xs font-medium text-focus-gray-500"
          >
            Admin
          </NuxtLink>
          <div v-if="user" class="flex items-center gap-2 rounded-focus border border-focus-gray-200 px-2 py-1">
            <p class="text-sm font-semibold text-focus-gray-900">
              <span class="text-xs">{{ user.credits }}</span>
              <span class="ml-1 text-xs">crédits</span>
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
import AppNavContent from '~/components/app/AppNavContent.vue'

const { user, isAdmin } = useAuth()
const route = useRoute()
const menuOpen = ref(false)

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

watch(() => route.path, () => {
  menuOpen.value = false
})

watch(menuOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

onUnmounted(() => {
  document.body.style.overflow = ''
})
</script>
