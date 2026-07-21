<script setup lang="ts">
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import OccurrenceCard from '~/components/OccurrenceCard.vue'
import type { OccurrenceItem } from '~/components/OccurrenceCard.vue'

definePageMeta({ layout: 'app', middleware: 'auth' })

const { user } = useAuth()
const filter = ref('today')
const { data: goalsData } = useGoals()
const { data: occurrencesData, isPending: occurrencesLoading } = useOccurrences(filter)

const showCompleteModal = ref(false)
const selectedOccurrenceId = ref('')
const showCelebration = ref(false)
const celebrationData = ref<import('~/components/StreakCelebrationModal.vue').StreakCelebrationData | null>(null)

const { data: streakData } = useStreak()

const todayLabel = computed(() =>
  format(new Date(), "EEEE d MMMM", { locale: fr }),
)

const todayOccurrences = computed(() => occurrencesData.value?.occurrences ?? [])

function isOverdue(occurrence: OccurrenceItem) {
  return occurrence.status === 'pending' && new Date(occurrence.dueAt) < new Date()
}

const todayStats = computed(() => {
  let pending = 0
  let completed = 0
  let failed = 0
  let overdue = 0

  for (const occurrence of todayOccurrences.value) {
    if (occurrence.status === 'completed') completed++
    else if (occurrence.status === 'failed') failed++
    else if (isOverdue(occurrence)) overdue++
    else if (occurrence.status === 'pending') pending++
  }

  return {
    total: todayOccurrences.value.length,
    pending,
    completed,
    failed,
    overdue,
  }
})

const progressPercent = computed(() => {
  if (!todayStats.value.total) return 0
  return Math.round((todayStats.value.completed / todayStats.value.total) * 100)
})

const activeGoalsCount = computed(() => goalsData.value?.goals?.length ?? 0)

const motivationMessage = computed(() => {
  const { total, completed, overdue } = todayStats.value
  if (!total) return 'Aucune échéance prévue — profitez-en pour planifier la suite.'
  if (completed === total) return 'Journée parfaite. Toutes vos échéances sont validées.'
  if (overdue > 0) return `${overdue} échéance${overdue > 1 ? 's' : ''} en retard — rattrapez-les pour éviter les pénalités.`
  if (completed > 0) return `Bon rythme. Encore ${total - completed} échéance${total - completed > 1 ? 's' : ''} à valider.`
  return `${total} échéance${total > 1 ? 's' : ''} vous attend${total > 1 ? 'ent' : ''} aujourd'hui.`
})

function openComplete(id: string) {
  selectedOccurrenceId.value = id
  showCompleteModal.value = true
}

function onOccurrenceComplete(payload: { streak: any }) {
  if (payload.streak?.dailyPerfect) {
    celebrationData.value = {
      dailyPerfect: payload.streak.dailyPerfect,
      currentStreak: payload.streak.streak.currentStreak,
      longestStreak: payload.streak.streak.longestStreak,
      nextMilestone: payload.streak.streak.nextMilestone,
      progressToNext: payload.streak.streak.progressToNext,
      bonusAwarded: payload.streak.bonusAwarded,
      milestoneReached: payload.streak.milestoneReached,
    }
    showCelebration.value = true
  }
}

const streakProgressPercent = computed(() => {
  const progress = streakData.value?.streak?.progressToNext ?? 0
  return Math.round((progress / 7) * 100)
})
</script>

<template>
  <div class="app-page animate-fade-in">
    <section class="animate-slide-up">
      <p class="app-eyebrow">Aujourd'hui</p>
      <h1 class="app-heading mt-1 capitalize">
        {{ todayLabel }}
      </h1>
      <p class="mt-2 text-base text-app-secondary">
        Bonjour <span class="font-semibold text-app-ink">{{ user?.displayName }}</span>
      </p>
      <p class="mt-3 max-w-xl text-sm leading-relaxed text-app-secondary">
        {{ motivationMessage }}
      </p>

      <div class="mt-5 flex flex-wrap gap-2">
        <span class="app-chip">{{ user?.credits ?? 0 }} crédits</span>
        <span v-if="user?.debt" class="app-chip-neutral !text-red-600">{{ user.debt }} dette</span>
        <span class="app-chip-neutral">Score {{ user?.netScore ?? 0 }}</span>
      </div>
    </section>

    <section class="mt-8">
      <div class="flex items-end justify-between gap-4">
        <div>
          <p class="text-sm font-semibold text-app-ink">
            {{ todayStats.completed }} / {{ todayStats.total }} validée{{ todayStats.completed > 1 ? 's' : '' }}
          </p>
          <p class="mt-0.5 text-xs text-app-secondary">
            {{ activeGoalsCount }} objectif{{ activeGoalsCount > 1 ? 's' : '' }} · série {{ streakData?.streak?.currentStreak ?? 0 }} j
          </p>
        </div>
        <p class="text-2xl font-semibold tabular-nums text-app-blue">{{ progressPercent }}%</p>
      </div>

      <div class="app-progress mt-3">
        <div
          class="app-progress-bar"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>

      <div class="mt-3 flex items-center justify-between gap-3 text-xs text-app-secondary">
        <span>Prochain bonus série {{ streakData?.streak?.progressToNext ?? 0 }}/7</span>
        <div class="h-1 w-20 overflow-hidden rounded-full bg-app-line">
          <div
            class="h-full rounded-full bg-app-muted transition-all duration-700"
            :style="{ width: `${streakProgressPercent}%` }"
          />
        </div>
      </div>
    </section>

    <section class="mt-10">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 class="app-section-title">Échéances</h2>
          <p class="mt-0.5 text-sm text-app-secondary">
            {{ todayStats.total }} au programme
          </p>
        </div>
        <NuxtLink
          to="/app/objectifs/nouveau"
          class="app-button-primary !px-4"
          aria-label="Nouvel objectif"
        >
          <AppIcon name="plus" class="h-4 w-4" />
          <span>Objectif</span>
        </NuxtLink>
      </div>

      <div v-if="occurrencesLoading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="app-row h-20 animate-pulse bg-white/70" />
      </div>

      <div v-else-if="!todayOccurrences.length" class="app-sheet px-6 py-16 text-center">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-app-mist text-app-blue">
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 7v5l3 2" />
          </svg>
        </div>
        <p class="mt-5 text-lg font-semibold text-app-ink">Journée libre</p>
        <p class="mx-auto mt-2 max-w-xs text-sm text-app-secondary">
          Aucune échéance pour aujourd'hui. Créez un objectif pour rester engagé.
        </p>
        <NuxtLink to="/app/objectifs/nouveau" class="app-button-primary mt-7 inline-flex">
          Créer un objectif
        </NuxtLink>
      </div>

      <div v-else class="app-list-stagger space-y-3">
        <OccurrenceCard
          v-for="occ in todayOccurrences"
          :key="occ.id"
          :occurrence="occ"
          @complete="openComplete"
        />
      </div>
    </section>

    <CompleteOccurrenceModal
      v-model="showCompleteModal"
      :occurrence-id="selectedOccurrenceId"
      :reward-credits="10"
      @success="onOccurrenceComplete"
    />

    <StreakCelebrationModal
      v-model="showCelebration"
      :data="celebrationData"
    />
  </div>
</template>
