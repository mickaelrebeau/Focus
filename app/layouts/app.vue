<template>
  <div data-app-shell class="app-shell">
    <!-- Desktop sidebar -->
    <aside class="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-app-line/60 bg-white/80 backdrop-blur-xl lg:flex">
      <AppNavContent
        :items="navItems"
        :user="user"
        :is-admin="isAdmin"
      />
    </aside>

    <!-- Mobile drawer -->
    <Teleport to="body">
      <Transition name="app-drawer">
        <div v-if="menuOpen" class="app-overlay fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            class="absolute inset-0 bg-slate-950/25"
            aria-label="Fermer le menu"
            @click="menuOpen = false"
          />
          <aside class="app-drawer-panel absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-app-line/70 bg-white shadow-app-soft">
            <div class="flex h-16 shrink-0 items-center justify-between px-5">
              <AppLogo to="/app" size="sm" />
              <button
                type="button"
                class="flex h-11 w-11 items-center justify-center rounded-full text-app-secondary transition hover:bg-app-mist hover:text-app-ink"
                aria-label="Fermer le menu"
                @click="menuOpen = false"
              >
                <AppIcon name="close" class="h-5 w-5" />
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
      </Transition>
    </Teleport>

    <!-- Mobile header -->
    <header class="sticky top-0 z-30 bg-app-canvas/80 backdrop-blur-xl pt-safe lg:hidden">
      <div class="flex h-14 items-center justify-between gap-3 px-5">
        <div class="flex min-w-0 items-center gap-2">
          <button
            type="button"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-app-ink transition hover:bg-white"
            aria-label="Ouvrir le menu"
            @click="menuOpen = true"
          >
            <AppIcon name="menu" class="h-5 w-5" />
          </button>
          <AppLogo to="/app" :show-label="false" size="md" />
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <NuxtLink
            v-if="isAdmin"
            to="/admin"
            class="text-xs font-medium text-app-secondary"
          >
            Admin
          </NuxtLink>
          <div v-if="user" class="app-chip">
            <span>{{ user.credits }}</span>
            <span class="font-medium opacity-80">crédits</span>
          </div>
        </div>
      </div>
    </header>

    <main class="lg:pl-64">
      <div class="pb-28 lg:pb-8">
        <slot />
      </div>
    </main>

    <!-- Mobile floating tab bar (iOS glass pill) -->
    <nav class="app-nav-shell pointer-events-none fixed inset-x-0 bottom-0 z-30 lg:hidden">
      <div class="app-nav-glass pointer-events-auto">
        <NuxtLink
          v-for="item in mobileNavItems"
          :key="item.to"
          :to="item.to"
          class="app-nav-item"
          :class="{ 'app-nav-item-active': isNavActive(item.to) }"
          :aria-current="isNavActive(item.to) ? 'page' : undefined"
        >
          <AppIcon :name="item.icon" class="h-5 w-5" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
import AppNavContent from '~/components/app/AppNavContent.vue'
import type { AppIconName } from '~/types/app-icon'

const { user, isAdmin } = useAuth()
const route = useRoute()
const menuOpen = ref(false)

interface AppNavItem {
  to: string
  label: string
  icon: AppIconName
}

const navItems: AppNavItem[] = [
  { to: '/app', label: 'Aujourd\'hui', icon: 'today' },
  { to: '/app/objectifs', label: 'Objectifs', icon: 'goals' },
  { to: '/app/agenda', label: 'Agenda', icon: 'agenda' },
  { to: '/app/classement', label: 'Classement', icon: 'ranking' },
  { to: '/cagnottes', label: 'Cagnottes', icon: 'heart' },
  { to: '/app/historique', label: 'Historique', icon: 'history' },
  { to: '/app/reglages', label: 'Réglages', icon: 'settings' },
]

const mobileNavItems: AppNavItem[] = [
  { to: '/app', label: 'Aujourd\'hui', icon: 'today' },
  { to: '/app/objectifs', label: 'Objectifs', icon: 'goals' },
  { to: '/app/agenda', label: 'Agenda', icon: 'agenda' },
  { to: '/app/historique', label: 'Historique', icon: 'history' },
]

function isNavActive(to: string) {
  if (to === '/app') return route.path === '/app'
  return route.path === to || route.path.startsWith(`${to}/`)
}

watch(() => route.path, () => {
  menuOpen.value = false
})

watch(menuOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

onUnmounted(() => {
  document.body.style.overflow = ''
})

useHead({
  meta: [
    { name: 'theme-color', content: '#FAFAFA' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
  ],
})
</script>

<style>
.app-drawer-enter-active,
.app-drawer-leave-active {
  transition: opacity 0.24s ease;
}

.app-drawer-enter-active .app-drawer-panel,
.app-drawer-leave-active .app-drawer-panel {
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.app-drawer-enter-from,
.app-drawer-leave-to {
  opacity: 0;
}

.app-drawer-enter-from .app-drawer-panel,
.app-drawer-leave-to .app-drawer-panel {
  transform: translateX(-100%);
}
</style>
