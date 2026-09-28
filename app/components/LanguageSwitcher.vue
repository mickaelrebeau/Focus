<script setup lang="ts">
import type { SupportedLocale } from '~/utils/locale'

// Teintes neutres : utilisable dans la mise en page publique (focus-*)
// comme dans l'espace connecté (app-*).
const { t } = useI18n()
const { locale, available, changeLanguage } = useLanguage()
</script>

<template>
  <div role="group" :aria-label="t('language.label')" class="inline-flex items-center rounded-full p-0.5 text-xs font-semibold ring-1 ring-inset ring-black/10">
    <button
      v-for="item in available"
      :key="item.code"
      type="button"
      :lang="item.code"
      :aria-pressed="locale === item.code"
      :title="item.name"
      class="min-h-8 rounded-full px-2.5 uppercase transition"
      :class="locale === item.code ? 'bg-black/[0.07]' : 'opacity-60 hover:opacity-100'"
      @click="changeLanguage(item.code as SupportedLocale)"
    >
      {{ item.code }}
    </button>
  </div>
</template>
