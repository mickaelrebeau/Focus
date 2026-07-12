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
  <div class="p-5 md:p-8">
    <section class="overflow-hidden rounded-focus-xl border border-focus-gray-200 bg-focus-white shadow-focus">
      <div class="border-b border-focus-gray-100 bg-gradient-to-br from-focus-gray-900 to-focus-gray-800 px-5 py-6 text-white md:px-8 md:py-8">
        <p class="text-xs font-medium uppercase tracking-wider text-white/60">Aujourd'hui</p>
        <h1 class="mt-1 text-2xl font-semibold capitalize md:text-3xl">{{ todayLabel }}</h1>
        <p class="mt-2 text-sm text-white/70">
          Bonjour <span class="font-medium text-white">{{ user?.displayName }}</span>
        </p>
        <p class="mt-4 max-w-xl text-sm leading-relaxed text-white/80">
          {{ motivationMessage }}
        </p>
      </div>

      <div class="grid divide-y divide-focus-gray-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div class="px-5 py-4 md:px-6">
          <p class="text-xs uppercase tracking-wide text-focus-gray-400">Crédits</p>
          <p class="mt-1 text-2xl font-semibold text-focus-gray-900">{{ user?.credits ?? 0 }}</p>
        </div>
        <div class="px-5 py-4 md:px-6">
          <p class="text-xs uppercase tracking-wide text-focus-gray-400">Dette</p>
          <p class="mt-1 text-2xl font-semibold" :class="user?.debt ? 'text-red-500' : 'text-focus-gray-900'">
            {{ user?.debt ?? 0 }}
          </p>
        </div>
        <div class="px-5 py-4 md:px-6">
          <p class="text-xs uppercase tracking-wide text-focus-gray-400">Score net</p>
          <p class="mt-1 text-2xl font-semibold text-focus-accent">{{ user?.netScore ?? 0 }}</p>
        </div>
      </div>
    </section>

    <section class="mt-6 grid gap-4 lg:grid-cols-3">
      <UiCard class="lg:col-span-2">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="focus-label">Progression du jour</p>
            <p class="mt-1 text-lg font-semibold text-focus-gray-900">
              {{ todayStats.completed }} / {{ todayStats.total }} validée{{ todayStats.completed > 1 ? 's' : '' }}
            </p>
          </div>
          <div class="text-right">
            <p class="text-2xl font-semibold text-focus-gray-900">{{ progressPercent }}%</p>
            <p class="text-xs text-focus-gray-400">{{ activeGoalsCount }} objectif{{ activeGoalsCount > 1 ? 's' : '' }} actif{{ activeGoalsCount > 1 ? 's' : '' }}</p>
          </div>
        </div>

        <div class="mt-4 h-2 overflow-hidden rounded-full bg-focus-gray-100">
          <div
            class="h-full rounded-full bg-focus-black transition-all duration-500"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <UiBadge v-if="todayStats.pending" variant="neutral">
            {{ todayStats.pending }} à faire
          </UiBadge>
          <UiBadge v-if="todayStats.overdue" variant="warning">
            {{ todayStats.overdue }} en retard
          </UiBadge>
          <UiBadge v-if="todayStats.completed" variant="success">
            {{ todayStats.completed }} réussie{{ todayStats.completed > 1 ? 's' : '' }}
          </UiBadge>
          <UiBadge v-if="todayStats.failed" variant="danger">
            {{ todayStats.failed }} échouée{{ todayStats.failed > 1 ? 's' : '' }}
          </UiBadge>
        </div>
      </UiCard>

      <UiCard>
        <p class="focus-label mb-1">Série en cours</p>
        <p class="text-3xl font-semibold text-focus-gray-900">
          {{ streakData?.streak?.currentStreak ?? 0 }}
          <span class="text-base font-normal text-focus-gray-400">jour{{ (streakData?.streak?.currentStreak ?? 0) > 1 ? 's' : '' }}</span>
        </p>
        <p class="mt-1 text-xs text-focus-gray-400">
          Record : {{ streakData?.streak?.longestStreak ?? 0 }} jour{{ (streakData?.streak?.longestStreak ?? 0) > 1 ? 's' : '' }}
        </p>
        <div class="mt-4">
          <div class="mb-1 flex justify-between text-xs text-focus-gray-400">
            <span>Prochain bonus</span>
            <span>{{ streakData?.streak?.progressToNext ?? 0 }}/7</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-focus-gray-100">
            <div
              class="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
              :style="{ width: `${streakProgressPercent}%` }"
            />
          </div>
          <p class="mt-2 text-xs text-focus-gray-400">+10 crédits tous les 7 jours réussis</p>
        </div>
      </UiCard>
    </section>

    <section class="mt-8">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 class="focus-heading-md">Échéances du jour</h2>
          <p class="focus-body-sm mt-1">
            {{ todayStats.total }} au programme
          </p>
        </div>
        <NuxtLink to="/app/objectifs/nouveau" class="focus-btn-primary shrink-0 text-xs">
          + Objectif
        </NuxtLink>
      </div>

      <div v-if="occurrencesLoading" class="space-y-4">
        <div v-for="i in 3" :key="i" class="focus-card h-24 animate-pulse bg-focus-gray-50" />
      </div>

      <div v-else-if="!todayOccurrences.length" class="focus-card py-14 text-center">
        <p class="text-4xl">◎</p>
        <p class="mt-4 font-medium text-focus-gray-900">Journée libre</p>
        <p class="mt-2 text-sm text-focus-gray-400">
          Aucune échéance pour aujourd'hui. Créez un objectif pour rester engagé.
        </p>
        <NuxtLink to="/app/objectifs/nouveau" class="focus-btn-primary mt-6 inline-flex">
          Créer un objectif
        </NuxtLink>
      </div>

      <div v-else class="space-y-4">
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
