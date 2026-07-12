<script setup lang="ts">
export interface LeaderboardEntry {
  userId: string
  displayName: string
  balance: number
  debt: number
  netScore: number
  rank: number
  currentStreak: number
  longestStreak: number
  isCurrentUser?: boolean
}

const props = defineProps<{
  entries: LeaderboardEntry[]
  currentUserId?: string
}>()

const podiumOrder = computed(() => {
  const top3 = props.entries.slice(0, 3)
  if (top3.length === 1) return [null, top3[0], null]
  if (top3.length === 2) return [top3[1], top3[0], null]
  return [top3[1], top3[0], top3[2]]
})

const rankStyles: Record<number, { border: string, bg: string, badge: string, label: string }> = {
  1: {
    border: 'border-amber-300',
    bg: 'bg-gradient-to-b from-amber-50 to-white',
    badge: 'bg-amber-400 text-white',
    label: 'Or',
  },
  2: {
    border: 'border-slate-300',
    bg: 'bg-gradient-to-b from-slate-50 to-white',
    badge: 'bg-slate-400 text-white',
    label: 'Argent',
  },
  3: {
    border: 'border-orange-300',
    bg: 'bg-gradient-to-b from-orange-50 to-white',
    badge: 'bg-orange-400 text-white',
    label: 'Bronze',
  },
}

function cardHeight(rank: number) {
  if (rank === 1) return 'min-h-[128px] sm:min-h-[160px] md:min-h-[180px]'
  if (rank === 2) return 'min-h-[112px] sm:min-h-[140px] md:min-h-[150px]'
  return 'min-h-[100px] sm:min-h-[120px] md:min-h-[130px]'
}
</script>

<template>
  <div v-if="entries.length" class="grid grid-cols-3 items-end gap-1.5 sm:gap-3 md:gap-5">
    <div
      v-for="(entry, index) in podiumOrder"
      :key="entry?.userId ?? `empty-${index}`"
      class="flex flex-col items-center"
      :class="index === 1 ? 'order-2' : index === 0 ? 'order-1' : 'order-3'"
    >
      <div
        v-if="entry"
        class="focus-card w-full min-w-0 border-2 p-2.5 text-center transition sm:p-3 md:p-4"
        :class="[
          rankStyles[entry.rank]?.border,
          rankStyles[entry.rank]?.bg,
          cardHeight(entry.rank),
          entry.isCurrentUser ? 'ring-2 ring-focus-accent' : '',
          entry.rank === 1 ? 'shadow-focus-lg md:scale-105' : 'shadow-focus',
        ]"
      >
        <span
          class="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold sm:mb-3 sm:h-9 sm:w-9 sm:text-sm md:h-10 md:w-10"
          :class="rankStyles[entry.rank]?.badge"
        >
          {{ entry.rank }}
        </span>
        <p class="truncate text-sm font-semibold text-focus-gray-900 sm:text-base">{{ entry.displayName }}</p>
        <p v-if="entry.isCurrentUser" class="text-[10px] font-medium text-focus-accent sm:text-xs">Vous</p>
        <p class="mt-0.5 text-lg font-semibold text-focus-gray-900 sm:mt-1 sm:text-xl md:text-2xl">{{ entry.netScore }}</p>
        <p class="text-[10px] text-focus-gray-400 sm:text-xs">{{ entry.balance }} cr · {{ entry.debt }} dette</p>
        <p class="mt-1 text-[10px] text-amber-600 sm:mt-2 sm:text-xs">
          {{ entry.currentStreak }}j streak
        </p>
      </div>
      <div v-else class="w-full" :class="index === 1 ? 'min-h-[128px] sm:min-h-[160px] md:min-h-[180px]' : 'min-h-[100px] sm:min-h-[120px] md:min-h-[130px]'" />
    </div>
  </div>
</template>
