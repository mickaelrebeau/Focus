<script setup lang="ts">
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import OccurrenceCard from '~/components/OccurrenceCard.vue'
import type { OccurrenceItem } from '~/components/OccurrenceCard.vue'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route = useRoute()
const id = computed(() => route.params.id as string)

const { data, pending, refresh } = useFetch(
  () => `/api/goals/${id.value}`,
  { credentials: 'include' },
)

const occurrenceFilter = ref<'all' | 'pending' | 'completed'>('all')
const showCompleteModal = ref(false)
const showArchiveConfirm = ref(false)
const selectedOccurrenceId = ref('')
const archiving = ref(false)
const showCelebration = ref(false)
const celebrationData = ref<any>(null)

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
  refresh()
}

const typeLabels: Record<string, string> = {
  one_time: 'Ponctuel',
  recurring: 'Récurrent',
  project: 'Projet',
}

const dayLabels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

const statusLabels: Record<string, string> = {
  pending: 'À faire',
  completed: 'Réussi',
  failed: 'Échoué',
  skipped: 'Ignoré',
}

const goal = computed(() => data.value?.goal)
const occurrences = computed(() => data.value?.occurrences ?? [])

function isOverdue(occurrence: { status: string, dueAt: string }) {
  return occurrence.status === 'pending' && new Date(occurrence.dueAt) < new Date()
}

const occurrenceStats = computed(() => {
  let pending = 0
  let completed = 0
  let failed = 0
  let overdue = 0

  for (const occurrence of occurrences.value) {
    if (occurrence.status === 'completed') completed++
    else if (occurrence.status === 'failed') failed++
    else if (isOverdue(occurrence)) overdue++
    else if (occurrence.status === 'pending') pending++
  }

  return {
    total: occurrences.value.length,
    pending,
    completed,
    failed,
    overdue,
  }
})

const progressPercent = computed(() => {
  const processed = occurrenceStats.value.completed + occurrenceStats.value.failed
  if (!occurrenceStats.value.total) return 0
  return Math.round((processed / occurrenceStats.value.total) * 100)
})

const recurrenceLabel = computed(() => {
  const current = goal.value
  if (!current || current.type !== 'recurring') return null

  const config = current.recurrenceConfig
  const time = config?.dueTime ? ` à ${config.dueTime}` : ''

  if (current.recurrenceType === 'daily') {
    return `Tous les jours${time}`
  }

  if (current.recurrenceType === 'weekly_days' && config?.daysOfWeek?.length) {
    const days = [...config.daysOfWeek]
      .sort((a, b) => a - b)
      .map(day => dayLabels[day])
      .join(', ')
    return `${days}${time}`
  }

  if (current.recurrenceType === 'weekly_count' && config?.timesPerWeek) {
    return `${config.timesPerWeek} fois par semaine${time}`
  }

  return 'Récurrent'
})

const dueDateLabel = computed(() => {
  if (!goal.value?.dueDate) return null
  return format(parseISO(goal.value.dueDate), 'd MMMM yyyy', { locale: fr })
})

const filteredOccurrences = computed(() => {
  const list = [...occurrences.value]

  if (occurrenceFilter.value === 'pending') {
    return list.filter(occ => occ.status === 'pending')
  }

  if (occurrenceFilter.value === 'completed') {
    return list.filter(occ => occ.status === 'completed' || occ.status === 'failed')
  }

  return list
})

const occurrenceCards = computed<OccurrenceItem[]>(() => {
  if (!goal.value) return []

  return filteredOccurrences.value.map((occurrence) => {
    const milestone = goal.value?.milestones?.find(m => m.id === occurrence.milestoneId)

    return {
      id: occurrence.id,
      status: occurrence.status,
      dueAt: occurrence.dueAt,
      dueDate: occurrence.dueDate,
      goal: {
        id: goal.value!.id,
        title: goal.value!.title,
        type: goal.value!.type,
        category: goal.value!.category ?? undefined,
        rewardCredits: goal.value!.rewardCredits,
        penaltyCredits: goal.value!.penaltyCredits,
      },
      milestone: milestone ? { id: milestone.id, title: milestone.title } : null,
      validation: null,
    }
  })
})

function milestoneStatus(milestoneId: string, dueDate?: string | null) {
  const occurrence = occurrences.value.find(occ => occ.milestoneId === milestoneId)
  if (occurrence?.status === 'completed') return 'completed'
  if (occurrence?.status === 'failed') return 'failed'
  if (occurrence && isOverdue(occurrence)) return 'overdue'
  if (dueDate && parseISO(`${dueDate}T12:00:00`) < new Date()) return 'overdue'
  return 'pending'
}

function milestoneBadgeVariant(status: string) {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'overdue') return 'warning'
  return 'neutral'
}

function milestoneStatusLabel(status: string) {
  if (status === 'completed') return 'Terminé'
  if (status === 'failed') return 'Échoué'
  if (status === 'overdue') return 'En retard'
  return 'À venir'
}

function formatOccurrenceDate(value: string, dueAt: string) {
  return format(new Date(dueAt), "EEE d MMM · HH:mm", { locale: fr })
}

function openComplete(occurrenceId: string) {
  selectedOccurrenceId.value = occurrenceId
  showCompleteModal.value = true
}

async function archiveGoal() {
  archiving.value = true
  try {
    await $fetch(`/api/goals/${id.value}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    await navigateTo('/app/objectifs')
  } finally {
    archiving.value = false
    showArchiveConfirm.value = false
  }
}
</script>

<template>
  <div class="app-page animate-fade-in">
    <div v-if="pending" class="space-y-3">
      <div class="app-sheet h-40 animate-pulse" />
      <div class="app-row h-20 animate-pulse" />
      <div class="app-row h-20 animate-pulse" />
    </div>

    <template v-else-if="goal">
      <NuxtLink
        to="/app/objectifs"
        class="inline-flex items-center gap-1 text-sm font-medium text-app-secondary transition hover:text-app-blue"
      >
        ← Objectifs
      </NuxtLink>

      <section class="mt-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="app-chip-neutral">{{ typeLabels[goal.type] ?? goal.type }}</span>
          <span v-if="goal.category" class="app-chip-neutral">{{ goal.category }}</span>
          <AppUiBadge :variant="goal.isActive ? 'success' : 'warning'">
            {{ goal.isActive ? 'Actif' : 'Archivé' }}
          </AppUiBadge>
        </div>

        <h1 class="app-heading mt-4">
          {{ goal.title }}
        </h1>
        <p v-if="goal.description" class="mt-3 max-w-2xl text-sm leading-relaxed text-app-secondary">
          {{ goal.description }}
        </p>

        <div v-if="recurrenceLabel || dueDateLabel" class="mt-4 flex flex-wrap gap-2">
          <span v-if="recurrenceLabel" class="app-chip-neutral">{{ recurrenceLabel }}</span>
          <span v-if="dueDateLabel" class="app-chip-neutral">{{ dueDateLabel }}</span>
        </div>

        <div class="mt-6 flex flex-wrap gap-2">
          <span class="app-chip">+{{ goal.rewardCredits }} crédits</span>
          <span class="app-chip-neutral !text-red-500">−{{ goal.penaltyCredits }}</span>
          <span class="app-chip-neutral">{{ progressPercent }}% traité</span>
        </div>

        <div class="app-progress mt-4">
          <div class="app-progress-bar" :style="{ width: `${progressPercent}%` }" />
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <AppUiBadge v-if="occurrenceStats.pending" variant="neutral">{{ occurrenceStats.pending }} à faire</AppUiBadge>
          <AppUiBadge v-if="occurrenceStats.overdue" variant="warning">{{ occurrenceStats.overdue }} en retard</AppUiBadge>
          <AppUiBadge v-if="occurrenceStats.completed" variant="success">{{ occurrenceStats.completed }} réussie{{ occurrenceStats.completed > 1 ? 's' : '' }}</AppUiBadge>
          <AppUiBadge v-if="occurrenceStats.failed" variant="danger">{{ occurrenceStats.failed }} échouée{{ occurrenceStats.failed > 1 ? 's' : '' }}</AppUiBadge>
        </div>

        <div class="mt-6 flex flex-wrap gap-2">
          <NuxtLink to="/app/agenda" class="app-button-secondary text-sm">
            Voir l'agenda
          </NuxtLink>
          <AppUiButton
            variant="ghost"
            class="text-red-500"
            @click="showArchiveConfirm = true"
          >
            Archiver
          </AppUiButton>
        </div>
      </section>

      <section v-if="goal.milestones?.length" class="mt-10">
        <h2 class="app-section-title">Jalons</h2>
        <p class="mt-0.5 text-sm text-app-secondary">
          {{ goal.milestones.length }} étape{{ goal.milestones.length > 1 ? 's' : '' }}
        </p>

        <div class="mt-4 space-y-3">
          <div
            v-for="(milestone, index) in [...goal.milestones].sort((a, b) => a.orderIndex - b.orderIndex)"
            :key="milestone.id"
            class="app-row flex items-start gap-4"
          >
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-app-mist text-sm font-semibold text-app-blue">
              {{ index + 1 }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="font-semibold text-app-ink">{{ milestone.title }}</h3>
                <AppUiBadge :variant="milestoneBadgeVariant(milestoneStatus(milestone.id, milestone.dueDate))">
                  {{ milestoneStatusLabel(milestoneStatus(milestone.id, milestone.dueDate)) }}
                </AppUiBadge>
              </div>
              <p v-if="milestone.description" class="mt-1 text-sm text-app-secondary">
                {{ milestone.description }}
              </p>
              <p v-if="milestone.dueDate" class="mt-2 text-xs text-app-secondary">
                {{ format(parseISO(milestone.dueDate), "d MMMM yyyy", { locale: fr }) }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="mt-10">
        <div class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 class="app-section-title">Échéances</h2>
            <p class="mt-0.5 text-sm text-app-secondary">Historique et prochaines échéances</p>
          </div>
          <div class="flex gap-2 overflow-x-auto">
            <button
              v-for="item in [
                { value: 'all', label: 'Toutes' },
                { value: 'pending', label: 'À faire' },
                { value: 'completed', label: 'Terminées' },
              ]"
              :key="item.value"
              type="button"
              class="shrink-0 rounded-full px-4 py-2.5 text-sm font-medium transition"
              :class="occurrenceFilter === item.value
                ? 'bg-app-blue text-white shadow-sm'
                : 'bg-white text-app-secondary ring-1 ring-inset ring-app-line'"
              :aria-pressed="occurrenceFilter === item.value"
              @click="occurrenceFilter = item.value as typeof occurrenceFilter"
            >
              {{ item.label }}
            </button>
          </div>
        </div>

        <div v-if="!filteredOccurrences.length" class="app-sheet py-12 text-center">
          <p class="text-app-secondary">Aucune échéance dans cette catégorie.</p>
        </div>

        <div v-else-if="occurrenceFilter === 'pending'" class="app-list-stagger space-y-3">
          <OccurrenceCard
            v-for="occ in occurrenceCards"
            :key="occ.id"
            :occurrence="occ"
            @complete="openComplete"
          />
        </div>

        <div v-else class="app-list-stagger space-y-3">
          <div
            v-for="occ in filteredOccurrences"
            :key="occ.id"
            class="app-row flex items-center justify-between"
          >
            <div>
              <p class="text-sm font-semibold capitalize text-app-ink">
                {{ formatOccurrenceDate(occ.dueDate, occ.dueAt) }}
              </p>
              <p class="mt-1 text-xs text-app-secondary">
                {{ statusLabels[occ.status] ?? occ.status }}
              </p>
            </div>
            <AppUiBadge
              :variant="occ.status === 'completed'
                ? 'success'
                : occ.status === 'failed'
                  ? 'danger'
                  : isOverdue(occ)
                    ? 'warning'
                    : 'neutral'"
            >
              {{ isOverdue(occ) && occ.status === 'pending' ? 'En retard' : statusLabels[occ.status] ?? occ.status }}
            </AppUiBadge>
          </div>
        </div>
      </section>

      <CompleteOccurrenceModal
        v-model="showCompleteModal"
        :occurrence-id="selectedOccurrenceId"
        :reward-credits="goal.rewardCredits"
        @success="onOccurrenceComplete"
      />

      <StreakCelebrationModal
        v-model="showCelebration"
        :data="celebrationData"
      />

      <Teleport to="body">
        <div
          v-if="showArchiveConfirm"
          class="app-overlay fixed inset-0 z-50 flex items-end justify-center bg-slate-950/25 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          @click.self="showArchiveConfirm = false"
          @keydown.esc="showArchiveConfirm = false"
        >
          <div
            class="w-full max-w-md animate-slide-up rounded-t-[28px] bg-white p-6 pb-safe shadow-app-soft sm:rounded-app-card sm:pb-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-title"
          >
            <h2 id="archive-title" class="text-xl font-semibold tracking-tight text-app-ink">Archiver cet objectif ?</h2>
            <p class="mt-2 text-sm text-app-secondary">
              L'objectif ne sera plus visible dans votre liste active. Les échéances passées sont conservées.
            </p>
            <div class="mt-6 flex gap-3">
              <AppUiButton variant="secondary" class="flex-1" @click="showArchiveConfirm = false">
                Annuler
              </AppUiButton>
              <AppUiButton class="flex-1 !text-red-600" variant="ghost" :loading="archiving" @click="archiveGoal">
                Archiver
              </AppUiButton>
            </div>
          </div>
        </div>
      </Teleport>
    </template>

    <div v-else class="app-sheet py-12 text-center">
      <p class="text-app-secondary">Objectif introuvable.</p>
      <NuxtLink to="/app/objectifs" class="app-button-secondary mt-4 inline-flex">
        Retour aux objectifs
      </NuxtLink>
    </div>
  </div>
</template>
