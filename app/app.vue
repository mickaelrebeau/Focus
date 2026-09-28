<script setup lang="ts">
const { localeProperties } = useI18n()

// Langue du document : lecteurs d'écran, césure, traduction automatique du navigateur
useHead({
  htmlAttrs: {
    lang: () => localeProperties.value.language ?? 'fr-FR',
  },
})
</script>

<template>
  <VitePwaManifest />
  <NuxtLayout>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </NuxtLayout>
</template>
