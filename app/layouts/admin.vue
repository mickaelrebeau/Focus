<template>
  <div class="min-h-dvh bg-focus-gray-50">
    <aside class="fixed inset-y-0 left-0 z-40 w-64 border-r border-focus-gray-200 bg-focus-gray-900 text-focus-white">
      <div class="flex h-16 items-center px-6">
        <AppLogo to="/admin" label="Focus Admin" variant="dark" />
      </div>
      <nav class="space-y-1 px-4">
        <NuxtLink
          v-for="item in adminNav"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-focus px-3 py-2.5 text-sm font-medium text-focus-gray-300 transition hover:bg-focus-gray-800 hover:text-focus-white"
          active-class="!bg-focus-gray-800 !text-focus-white"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>
      <div class="absolute bottom-0 left-0 right-0 border-t border-focus-gray-800 p-4">
        <NuxtLink to="/app" class="focus-btn-ghost w-full justify-start text-sm text-focus-gray-300">
          ← Retour à l'app
        </NuxtLink>
      </div>
    </aside>

    <main class="pl-64">
      <header class="sticky top-0 z-30 border-b border-focus-gray-200 bg-focus-white/90 backdrop-blur-xl">
        <div class="flex h-14 items-center justify-between px-8">
          <h1 class="text-sm font-medium text-focus-gray-500">Administration</h1>
          <span v-if="user" class="text-sm text-focus-gray-400">{{ user.email }}</span>
        </div>
      </header>
      <div class="p-8">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const { user } = useAuth()

const adminNav = [
  { to: '/admin', label: 'Tableau de bord' },
  { to: '/admin/utilisateurs', label: 'Utilisateurs' },
  { to: '/admin/moderation', label: 'Modération' },
  { to: '/admin/echeances', label: 'Échéances' },
  { to: '/admin/audit', label: 'Journal d\'audit' },
]
</script>
