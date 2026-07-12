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
  <div class="p-5 md:p-8">
    <div v-if="pending" class="space-y-4">
      <div class="focus-card h-48 animate-pulse bg-focus-gray-50" />
      <div class="focus-card h-32 animate-pulse bg-focus-gray-50" />
      <div class="focus-card h-64 animate-pulse bg-focus-gray-50" />
    </div>

    <template v-else-if="goal">
      <NuxtLink
        to="/app/objectifs"
        class="inline-flex items-center gap-1 text-sm font-medium text-focus-gray-400 transition hover:text-focus-gray-700"
      >
        ← Objectifs
      </NuxtLink>

      <section class="mt-4 overflow-hidden rounded-focus-xl border border-focus-gray-200 bg-focus-white shadow-focus">
        <div class="border-b border-focus-gray-100 px-5 py-6 md:px-8">
          <div class="flex flex-wrap items-center gap-2">
            <UiBadge variant="neutral">{{ typeLabels[goal.type] ?? goal.type }}</UiBadge>
            <UiBadge v-if="goal.category" variant="neutral">{{ goal.category }}</UiBadge>
            <UiBadge :variant="goal.isActive ? 'success' : 'warning'">
              {{ goal.isActive ? 'Actif' : 'Archivé' }}
            </UiBadge>
          </div>

          <h1 class="focus-heading-lg mt-4">{{ goal.title }}</h1>
          <p v-if="goal.description" class="focus-body mt-3 max-w-2xl">{{ goal.description }}</p>

          <div v-if="recurrenceLabel || dueDateLabel" class="mt-4 flex flex-wrap gap-3 text-sm text-focus-gray-500">
            <span v-if="recurrenceLabel" class="rounded-full bg-focus-gray-100 px-3 py-1">
              ◷ {{ recurrenceLabel }}
            </span>
            <span v-if="dueDateLabel" class="rounded-full bg-focus-gray-100 px-3 py-1">
              Échéance : {{ dueDateLabel }}
            </span>
          </div>
        </div>

        <div class="grid divide-y divide-focus-gray-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div class="px-5 py-4 md:px-6">
            <p class="text-xs uppercase tracking-wide text-focus-gray-400">Récompense</p>
            <p class="mt-1 text-2xl font-semibold text-emerald-600">+{{ goal.rewardCredits }}</p>
          </div>
          <div class="px-5 py-4 md:px-6">
            <p class="text-xs uppercase tracking-wide text-focus-gray-400">Pénalité</p>
            <p class="mt-1 text-2xl font-semibold text-red-500">-{{ goal.penaltyCredits }}</p>
          </div>
          <div class="px-5 py-4 md:px-6">
            <p class="text-xs uppercase tracking-wide text-focus-gray-400">Progression</p>
            <p class="mt-1 text-2xl font-semibold text-focus-gray-900">{{ progressPercent }}%</p>
          </div>
        </div>
      </section>

      <section class="mt-6 grid gap-4 lg:grid-cols-3">
        <UiCard class="lg:col-span-2">
          <p class="focus-label">Statistiques</p>
          <div class="mt-4 h-2 overflow-hidden rounded-full bg-focus-gray-100">
            <div
              class="h-full rounded-full bg-focus-black transition-all duration-500"
              :style="{ width: `${progressPercent}%` }"
            />
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <UiBadge variant="neutral">{{ occurrenceStats.total }} échéance{{ occurrenceStats.total > 1 ? 's' : '' }}</UiBadge>
            <UiBadge v-if="occurrenceStats.pending" variant="neutral">{{ occurrenceStats.pending }} à faire</UiBadge>
            <UiBadge v-if="occurrenceStats.overdue" variant="warning">{{ occurrenceStats.overdue }} en retard</UiBadge>
            <UiBadge v-if="occurrenceStats.completed" variant="success">{{ occurrenceStats.completed }} réussie{{ occurrenceStats.completed > 1 ? 's' : '' }}</UiBadge>
            <UiBadge v-if="occurrenceStats.failed" variant="danger">{{ occurrenceStats.failed }} échouée{{ occurrenceStats.failed > 1 ? 's' : '' }}</UiBadge>
          </div>
        </UiCard>

        <UiCard>
          <p class="focus-label mb-3">Actions</p>
          <div class="space-y-2">
            <NuxtLink to="/app/agenda" class="focus-btn-secondary w-full justify-center text-sm">
              Voir l'agenda
            </NuxtLink>
            <UiButton
              variant="ghost"
              class="w-full text-red-500"
              @click="showArchiveConfirm = true"
            >
              Archiver l'objectif
            </UiButton>
          </div>
        </UiCard>
      </section>

      <section v-if="goal.milestones?.length" class="mt-8">
        <h2 class="focus-heading-md">Jalons du projet</h2>
        <p class="focus-body-sm mt-1">{{ goal.milestones.length }} étape{{ goal.milestones.length > 1 ? 's' : '' }} planifiée{{ goal.milestones.length > 1 ? 's' : '' }}</p>

        <div class="mt-4 space-y-3">
          <div
            v-for="(milestone, index) in [...goal.milestones].sort((a, b) => a.orderIndex - b.orderIndex)"
            :key="milestone.id"
            class="focus-card flex items-start gap-4"
          >
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-focus-gray-100 text-sm font-semibold text-focus-gray-500">
              {{ index + 1 }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="font-medium text-focus-gray-900">{{ milestone.title }}</h3>
                <UiBadge :variant="milestoneBadgeVariant(milestoneStatus(milestone.id, milestone.dueDate))">
                  {{ milestoneStatusLabel(milestoneStatus(milestone.id, milestone.dueDate)) }}
                </UiBadge>
              </div>
              <p v-if="milestone.description" class="mt-1 text-sm text-focus-gray-500">
                {{ milestone.description }}
              </p>
              <p v-if="milestone.dueDate" class="mt-2 text-xs text-focus-gray-400">
                {{ format(parseISO(milestone.dueDate), "d MMMM yyyy", { locale: fr }) }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="mt-8">
        <div class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 class="focus-heading-md">Échéances</h2>
            <p class="focus-body-sm mt-1">Historique et prochaines échéances de cet objectif</p>
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
              class="shrink-0 rounded-full px-4 py-2 text-sm font-medium transition"
              :class="occurrenceFilter === item.value
                ? 'bg-focus-black text-white'
                : 'bg-focus-gray-100 text-focus-gray-600 hover:bg-focus-gray-200'"
              @click="occurrenceFilter = item.value as typeof occurrenceFilter"
            >
              {{ item.label }}
            </button>
          </div>
        </div>

        <div v-if="!filteredOccurrences.length" class="focus-card py-12 text-center">
          <p class="text-focus-gray-400">Aucune échéance dans cette catégorie.</p>
        </div>

        <div v-else-if="occurrenceFilter === 'pending'" class="space-y-4">
          <OccurrenceCard
            v-for="occ in occurrenceCards"
            :key="occ.id"
            :occurrence="occ"
            @complete="openComplete"
          />
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="occ in filteredOccurrences"
            :key="occ.id"
            class="flex items-center justify-between rounded-focus-lg border border-focus-gray-200 bg-focus-white px-4 py-4 shadow-focus"
          >
            <div>
              <p class="text-sm font-medium capitalize text-focus-gray-900">
                {{ formatOccurrenceDate(occ.dueDate, occ.dueAt) }}
              </p>
              <p class="mt-1 text-xs text-focus-gray-400">
                {{ statusLabels[occ.status] ?? occ.status }}
              </p>
            </div>
            <UiBadge
              :variant="occ.status === 'completed'
                ? 'success'
                : occ.status === 'failed'
                  ? 'danger'
                  : isOverdue(occ)
                    ? 'warning'
                    : 'neutral'"
            >
              {{ isOverdue(occ) && occ.status === 'pending' ? 'En retard' : statusLabels[occ.status] ?? occ.status }}
            </UiBadge>
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
          class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          @click.self="showArchiveConfirm = false"
        >
          <div class="w-full max-w-md rounded-focus-xl bg-focus-white p-6 shadow-focus-lg">
            <h3 class="focus-heading-md">Archiver cet objectif ?</h3>
            <p class="focus-body-sm mt-2">
              L'objectif ne sera plus visible dans votre liste active. Les échéances passées sont conservées.
            </p>
            <div class="mt-6 flex gap-3">
              <UiButton variant="secondary" class="flex-1" @click="showArchiveConfirm = false">
                Annuler
              </UiButton>
              <UiButton class="flex-1" variant="ghost" :loading="archiving" @click="archiveGoal">
                Archiver
              </UiButton>
            </div>
          </div>
        </div>
      </Teleport>
    </template>

    <div v-else class="focus-card py-12 text-center">
      <p class="text-focus-gray-400">Objectif introuvable.</p>
      <NuxtLink to="/app/objectifs" class="focus-btn-secondary mt-4 inline-flex">
        Retour aux objectifs
      </NuxtLink>
    </div>
  </div>
</template>
