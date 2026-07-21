<script setup lang="ts">
import type { AppIconName } from '~/types/app-icon'

defineProps<{
  name: AppIconName
}>()

const paths: Record<AppIconName, string[]> = {
  today: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7v5l3 2'],
  goals: ['M12 3v18', 'M5 8h14', 'M7 13h10', 'M9 18h6'],
  agenda: ['M7 4v2M17 4v2', 'M5 9h14', 'M6 6h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z'],
  history: ['M4 7h16', 'M4 12h12', 'M4 17h8'],
  ranking: ['M8 18V10', 'M12 18V6', 'M16 18v-5'],
  heart: ['M20.8 8.6c0 5.4-8.8 10.4-8.8 10.4S3.2 14 3.2 8.6A4.6 4.6 0 0 1 12 6.7a4.6 4.6 0 0 1 8.8 1.9Z'],
  settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', 'M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.5-2.5 1a7 7 0 0 0-1.8-1L14.2 3h-4l-.4 2.8a7 7 0 0 0-1.8 1l-2.5-1-2 3.5 2 1.6a7 7 0 0 0 0 2.2l-2 1.6 2 3.5 2.5-1a7 7 0 0 0 1.8 1l.4 2.8h4l.4-2.8a7 7 0 0 0 1.8-1l2.5 1 2-3.5-2-1.6a7 7 0 0 0 .1-1Z'],
  bolt: ['m13 2-9 12h7l-1 8 9-12h-7l1-8Z'],
  plus: ['M12 5v14', 'M5 12h14'],
  check: ['M5 13l4 4L19 7'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
}
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="path in paths[name]" :key="path" :d="path" />
  </svg>
</template>
