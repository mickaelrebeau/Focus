<script setup lang="ts">
const isOnline = useOnline()
</script>

<template>
  <Transition name="app-offline">
    <div
      v-if="!isOnline"
      role="status"
      aria-live="polite"
      class="sticky top-0 z-30 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-900"
    >
      <span class="font-semibold">Hors ligne.</span>
      Données de votre dernière connexion ; les validations reprendront au retour du réseau.
    </div>
  </Transition>
</template>

<style scoped>
.app-offline-enter-active,
.app-offline-leave-active {
  transition: opacity 0.2s ease;
}

.app-offline-enter-from,
.app-offline-leave-to {
  opacity: 0;
}
</style>
