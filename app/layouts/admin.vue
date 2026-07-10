<template>
  <div class="min-h-dvh bg-focus-gray-50">
    <!-- Desktop sidebar -->
    <aside class="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-focus-gray-200 bg-focus-gray-900 text-focus-white lg:flex">
      <AdminNavContent :items="adminNav" />
    </aside>

    <!-- Mobile drawer -->
    <Teleport to="body">
      <div
        v-if="menuOpen"
        class="fixed inset-0 z-50 lg:hidden"
      >
        <button
          type="button"
          class="absolute inset-0 bg-black/50"
          aria-label="Fermer le menu"
          @click="menuOpen = false"
        />
        <aside class="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-focus-gray-800 bg-focus-gray-900 text-focus-white shadow-focus-lg">
          <div class="flex h-14 shrink-0 items-center justify-between border-b border-focus-gray-800 px-5">
            <AppLogo to="/admin" label="Focus Admin" variant="dark" size="sm" />
            <button
              type="button"
              class="flex h-10 w-10 items-center justify-center rounded-focus text-focus-gray-300 transition hover:bg-focus-gray-800 hover:text-focus-white"
              aria-label="Fermer le menu"
              @click="menuOpen = false"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <AdminNavContent
            :items="adminNav"
            :show-logo="false"
            class="min-h-0 flex-1"
            @navigate="menuOpen = false"
          />
        </aside>
      </div>
    </Teleport>

    <main class="lg:pl-64">
      <header class="sticky top-0 z-30 border-b border-focus-gray-200 bg-focus-white/90 backdrop-blur-xl pt-safe">
        <div class="flex h-14 items-center justify-between gap-4 px-5 md:px-8">
          <div class="flex min-w-0 items-center gap-3">
            <button
              type="button"
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-focus border border-focus-gray-200 text-focus-gray-700 transition hover:bg-focus-gray-50 lg:hidden"
              aria-label="Ouvrir le menu"
              @click="menuOpen = true"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <h1 class="truncate text-sm font-medium text-focus-gray-500">Administration</h1>
          </div>
          <span v-if="user" class="truncate text-sm text-focus-gray-400">{{ user.email }}</span>
        </div>
      </header>
      <div class="p-5 md:p-8">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import AdminNavContent from '~/components/admin/AdminNavContent.vue'

const { user } = useAuth()
const route = useRoute()
const menuOpen = ref(false)

const adminNav = [
  { to: '/admin', label: 'Tableau de bord' },
  { to: '/admin/utilisateurs', label: 'Utilisateurs' },
  { to: '/admin/moderation', label: 'Modération' },
  { to: '/admin/echeances', label: 'Échéances' },
  { to: '/admin/audit', label: 'Journal d\'audit' },
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
