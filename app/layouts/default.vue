<template>
  <div class="min-h-dvh bg-focus-white">
    <header class="sticky top-0 z-40 border-b border-focus-gray-100 bg-focus-white/80 backdrop-blur-xl pt-safe">
      <div class="focus-container flex h-14 items-center justify-between md:h-16">
        <AppLogo :to="isAuthenticated ? '/app' : '/'" />
        <nav class="flex items-center gap-2">
          <LanguageSwitcher class="mr-1 text-focus-gray-700" />
          <template v-if="isAuthenticated">
            <NuxtLink
              v-if="isAdmin"
              to="/admin"
              class="focus-btn-ghost hidden sm:inline-flex"
            >
              {{ t('nav.admin') }}
            </NuxtLink>
            <NuxtLink to="/cagnottes" class="focus-btn-ghost hidden sm:inline-flex">
              {{ t('nav.pots') }}
            </NuxtLink>
            <NuxtLink to="/app" class="focus-btn-primary text-sm">
              {{ t('nav.mySpace') }}
            </NuxtLink>
          </template>
          <template v-else>
            <NuxtLink to="/cagnottes" class="focus-btn-ghost hidden sm:inline-flex">
              {{ t('nav.pots') }}
            </NuxtLink>
            <NuxtLink to="/connexion" class="focus-btn-ghost hidden sm:inline-flex">
              {{ t('nav.login') }}
            </NuxtLink>
            <NuxtLink to="/inscription" class="focus-btn-primary text-sm">
              {{ t('nav.getStarted') }}
            </NuxtLink>
          </template>
        </nav>
      </div>
    </header>
    <main>
      <slot />
    </main>
    <footer class="border-t border-focus-gray-100 py-12">
      <div class="focus-container flex flex-col gap-4 text-sm text-focus-gray-400 md:flex-row md:items-center md:justify-between">
        <p>{{ t('nav.copyright', { year: new Date().getFullYear() }) }}</p>
        <div class="flex flex-wrap gap-6">
          <NuxtLink to="/cagnottes" class="hover:text-focus-gray-700">{{ t('nav.pots') }}</NuxtLink>
          <template v-if="isAuthenticated">
            <NuxtLink to="/app" class="hover:text-focus-gray-700">{{ t('nav.mySpace') }}</NuxtLink>
          </template>
          <template v-else>
            <NuxtLink to="/connexion" class="hover:text-focus-gray-700">{{ t('nav.login') }}</NuxtLink>
            <NuxtLink to="/inscription" class="hover:text-focus-gray-700">{{ t('nav.signup') }}</NuxtLink>
          </template>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
const { isAuthenticated, isAdmin } = useAuth()
const { t } = useI18n()
</script>
