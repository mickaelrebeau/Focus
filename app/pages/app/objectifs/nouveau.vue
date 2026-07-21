<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })

const { createGoal } = useGoals()

const step = ref(1)
const goalType = ref<'one_time' | 'recurring' | 'project'>('recurring')
const title = ref('')
const description = ref('')
const category = ref('')
const dueDate = ref('')
const recurrenceType = ref<'daily' | 'weekly_days' | 'weekly_count'>('daily')
const daysOfWeek = ref<number[]>([1, 3, 5])
const timesPerWeek = ref(3)
const milestones = ref([{ title: '', dueDate: '' }])
const error = ref('')

const dayLabels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

function toggleDay(day: number) {
  const idx = daysOfWeek.value.indexOf(day)
  if (idx >= 0) daysOfWeek.value.splice(idx, 1)
  else daysOfWeek.value.push(day)
}

function addMilestone() {
  milestones.value.push({ title: '', dueDate: '' })
}

async function handleSubmit() {
  error.value = ''
  try {
    const payload: Record<string, unknown> = {
      type: goalType.value,
      title: title.value,
      description: description.value || undefined,
      category: category.value || undefined,
    }

    if (goalType.value === 'one_time') {
      payload.dueDate = dueDate.value
    } else if (goalType.value === 'recurring') {
      payload.recurrenceType = recurrenceType.value
      payload.recurrenceConfig = {
        daysOfWeek: recurrenceType.value === 'weekly_days' ? daysOfWeek.value : undefined,
        timesPerWeek: recurrenceType.value === 'weekly_count' ? timesPerWeek.value : undefined,
        dueTime: '23:59',
      }
    } else {
      payload.milestones = milestones.value.filter(m => m.title)
    }

    await createGoal.mutateAsync(payload)
    await navigateTo('/app/objectifs')
  } catch (e: any) {
    error.value = e?.data?.message ?? 'Erreur'
  }
}
</script>

<template>
  <div class="app-page animate-fade-in">
    <NuxtLink
      to="/app/objectifs"
      class="mb-4 inline-flex text-sm font-medium text-app-secondary hover:text-app-blue"
    >
      ← Objectifs
    </NuxtLink>
    <p class="app-eyebrow">Créer un engagement</p>
    <h1 class="app-heading mt-1">Nouvel objectif</h1>

    <div v-if="step === 1" class="mt-8 space-y-3">
      <p class="text-sm text-app-secondary">Quel type d'objectif ?</p>
      <button
        v-for="type in [
          { value: 'recurring', label: 'Récurrent', desc: 'Chaque jour, certains jours ou N fois/semaine' },
          { value: 'one_time', label: 'Ponctuel', desc: 'Une date limite unique' },
          { value: 'project', label: 'Projet', desc: 'Plusieurs jalons à atteindre' },
        ]"
        :key="type.value"
        class="app-row w-full text-left"
        :class="{ 'ring-2 ring-app-blue/40': goalType === type.value }"
        @click="goalType = type.value as any; step = 2"
      >
        <h3 class="font-semibold text-app-ink">{{ type.label }}</h3>
        <p class="mt-1 text-sm text-app-secondary">{{ type.desc }}</p>
      </button>
    </div>

    <form v-if="step === 2" class="mt-8 max-w-lg space-y-5" @submit.prevent="handleSubmit">
      <AppUiInput v-model="title" label="Titre" required placeholder="Ex: Publier sur X" />
      <AppUiInput v-model="description" label="Description" placeholder="Optionnel" />
      <AppUiInput v-model="category" label="Catégorie" placeholder="Ex: Réseaux sociaux, Sport..." />

      <AppUiInput v-if="goalType === 'one_time'" v-model="dueDate" label="Date limite" type="date" required />

      <div v-if="goalType === 'recurring'" class="space-y-4">
        <div>
          <label class="text-sm font-semibold text-app-ink">Fréquence</label>
          <select v-model="recurrenceType" class="app-input mt-1.5">
            <option value="daily">Tous les jours</option>
            <option value="weekly_days">Certains jours</option>
            <option value="weekly_count">N fois par semaine</option>
          </select>
        </div>
        <div v-if="recurrenceType === 'weekly_days'" class="flex flex-wrap gap-2">
          <button
            v-for="(label, i) in dayLabels"
            :key="i"
            type="button"
            class="flex h-11 w-11 items-center justify-center rounded-full text-xs font-medium transition"
            :class="daysOfWeek.includes(i) ? 'bg-app-blue text-white' : 'bg-white text-app-secondary ring-1 ring-inset ring-app-line'"
            @click="toggleDay(i)"
          >
            {{ label }}
          </button>
        </div>
        <AppUiInput v-if="recurrenceType === 'weekly_count'" v-model="timesPerWeek" label="Fois par semaine" type="number" />
      </div>

      <div v-if="goalType === 'project'" class="space-y-4">
        <div v-for="(m, i) in milestones" :key="i" class="app-sheet space-y-2 p-4">
          <AppUiInput v-model="m.title" :label="`Jalon ${i + 1}`" required />
          <AppUiInput v-model="m.dueDate" label="Date" type="date" />
        </div>
        <AppUiButton type="button" variant="secondary" @click="addMilestone">+ Ajouter un jalon</AppUiButton>
      </div>

      <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

      <div class="flex gap-3">
        <AppUiButton type="button" variant="secondary" @click="step = 1">Retour</AppUiButton>
        <AppUiButton type="submit" :loading="createGoal.isPending.value">Créer l'objectif</AppUiButton>
      </div>
    </form>
  </div>
</template>
