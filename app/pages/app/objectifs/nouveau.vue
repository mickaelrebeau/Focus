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
  <div class="p-5 md:p-8">
    <h1 class="focus-heading-lg">Nouvel objectif</h1>

    <div v-if="step === 1" class="mt-8 space-y-4">
      <p class="focus-body">Quel type d'objectif ?</p>
      <button
        v-for="type in [
          { value: 'recurring', label: 'Récurrent', desc: 'Chaque jour, certains jours ou N fois/semaine' },
          { value: 'one_time', label: 'Ponctuel', desc: 'Une date limite unique' },
          { value: 'project', label: 'Projet', desc: 'Plusieurs jalons à atteindre' },
        ]"
        :key="type.value"
        class="focus-card w-full text-left transition"
        :class="{ 'border-focus-gray-900': goalType === type.value }"
        @click="goalType = type.value as any; step = 2"
      >
        <h3 class="font-medium text-focus-gray-900">{{ type.label }}</h3>
        <p class="focus-body-sm mt-1">{{ type.desc }}</p>
      </button>
    </div>

    <form v-if="step === 2" class="mt-8 max-w-lg space-y-5" @submit.prevent="handleSubmit">
      <UiInput v-model="title" label="Titre" required placeholder="Ex: Publier sur X" />
      <UiInput v-model="description" label="Description" placeholder="Optionnel" />
      <UiInput v-model="category" label="Catégorie" placeholder="Ex: Réseaux sociaux, Sport..." />

      <UiInput v-if="goalType === 'one_time'" v-model="dueDate" label="Date limite" type="date" required />

      <div v-if="goalType === 'recurring'" class="space-y-4">
        <div>
          <label class="text-sm font-medium text-focus-gray-700">Fréquence</label>
          <select v-model="recurrenceType" class="focus-input mt-1.5">
            <option value="daily">Tous les jours</option>
            <option value="weekly_days">Certains jours</option>
            <option value="weekly_count">N fois par semaine</option>
          </select>
        </div>
        <div v-if="recurrenceType === 'weekly_days'" class="flex gap-2">
          <button
            v-for="(label, i) in dayLabels"
            :key="i"
            type="button"
            class="flex h-10 w-10 items-center justify-center rounded-full text-xs font-medium transition"
            :class="daysOfWeek.includes(i) ? 'bg-focus-black text-white' : 'bg-focus-gray-100 text-focus-gray-500'"
            @click="toggleDay(i)"
          >
            {{ label }}
          </button>
        </div>
        <UiInput v-if="recurrenceType === 'weekly_count'" v-model="timesPerWeek" label="Fois par semaine" type="number" />
      </div>

      <div v-if="goalType === 'project'" class="space-y-4">
        <div v-for="(m, i) in milestones" :key="i" class="space-y-2 rounded-focus border border-focus-gray-100 p-4">
          <UiInput v-model="m.title" :label="`Jalon ${i + 1}`" required />
          <UiInput v-model="m.dueDate" label="Date" type="date" />
        </div>
        <UiButton type="button" variant="secondary" @click="addMilestone">+ Ajouter un jalon</UiButton>
      </div>

      <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

      <div class="flex gap-3">
        <UiButton type="button" variant="secondary" @click="step = 1">Retour</UiButton>
        <UiButton type="submit" :loading="createGoal.isPending.value">Créer l'objectif</UiButton>
      </div>
    </form>
  </div>
</template>
