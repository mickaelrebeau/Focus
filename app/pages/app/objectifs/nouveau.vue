<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue'
import { templateIcons } from '~/utils/template-icons'
import {
  findTemplate,
  goalCatalog,
  localizeEntry,
  templateToGoalPayload,
  type GoalPack,
  type GoalTemplate,
} from '#shared/goal-templates'

definePageMeta({ layout: 'app', middleware: 'auth' })

const { createGoal } = useGoals()
const route = useRoute()
const { t, locale } = useI18n()

const step = ref(1)
type GoalKind = 'one_time' | 'recurring' | 'project'
const goalType = ref<GoalKind>('recurring')
const title = ref('')
const description = ref('')
const category = ref('')
const dueDate = ref('')
const recurrenceType = ref<'daily' | 'weekly_days' | 'weekly_count'>('daily')
const daysOfWeek = ref<number[]>([1, 3, 5])
const timesPerWeek = ref(3)
const milestones = ref([{ title: '', dueDate: '' }])
const dueTime = ref('23:59')
const error = ref('')
const selectedTemplate = ref<GoalTemplate | null>(null)
const creatingPack = ref<string | null>(null)

const templates = computed(() => goalCatalog.templates.map(template => ({
  template,
  text: localizeEntry(template, locale.value),
})))
const packs = computed(() => goalCatalog.packs.map(pack => ({ pack, text: localizeEntry(pack, locale.value) })))

function recurrenceLabel(template: GoalTemplate) {
  const { recurrence } = template
  if (recurrence.type === 'daily') return t('templates.daily')
  if (recurrence.type === 'weekly_count') return t('templates.timesPerWeek', recurrence.timesPerWeek)
  return recurrence.daysOfWeek.map(day => dayLabels[day]).join(', ')
}

function consequenceLabel(template: GoalTemplate) {
  const suggestion = template.suggestedConsequence
  if (!suggestion) return ''
  return t(`templates.consequence.${suggestion.type}`, { amount: suggestion.amount ?? 0 })
}

// Préremplit le formulaire : tout reste modifiable avant la création
function applyTemplate(template: GoalTemplate) {
  const payload = templateToGoalPayload(template, locale.value)
  selectedTemplate.value = template
  goalType.value = 'recurring'
  title.value = payload.title
  description.value = payload.description ?? ''
  category.value = payload.category
  recurrenceType.value = payload.recurrenceType
  if (payload.recurrenceConfig.daysOfWeek) daysOfWeek.value = [...payload.recurrenceConfig.daysOfWeek]
  if (payload.recurrenceConfig.timesPerWeek) timesPerWeek.value = payload.recurrenceConfig.timesPerWeek
  dueTime.value = payload.recurrenceConfig.dueTime
  step.value = 2
}

function startFromScratch(type: GoalKind) {
  selectedTemplate.value = null
  goalType.value = type
  title.value = ''
  description.value = ''
  category.value = ''
  recurrenceType.value = 'daily'
  daysOfWeek.value = [1, 3, 5]
  timesPerWeek.value = 3
  dueTime.value = '23:59'
  step.value = 2
}

// Lien direct vers un modèle : /app/objectifs/nouveau?template=<id>
const initialTemplate = typeof route.query.template === 'string' ? findTemplate(route.query.template) : undefined
if (initialTemplate) applyTemplate(initialTemplate)

async function createPack(pack: GoalPack) {
  error.value = ''
  creatingPack.value = pack.id
  try {
    for (const id of pack.templateIds) {
      await createGoal.mutateAsync(templateToGoalPayload(findTemplate(id)!, locale.value))
    }
    await navigateTo('/app/objectifs')
  } catch (e: any) {
    error.value = e?.data?.message ?? t('templates.packError')
  } finally {
    creatingPack.value = null
  }
}

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
      payload.dueTime = dueTime.value
    } else if (goalType.value === 'recurring') {
      payload.recurrenceType = recurrenceType.value
      payload.recurrenceConfig = {
        daysOfWeek: recurrenceType.value === 'weekly_days' ? daysOfWeek.value : undefined,
        timesPerWeek: recurrenceType.value === 'weekly_count' ? timesPerWeek.value : undefined,
        dueTime: dueTime.value,
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

    <section v-if="step === 1" class="mt-8" aria-labelledby="templates-title">
      <h2 id="templates-title" class="app-section-title">{{ t('templates.title') }}</h2>
      <p class="mt-1 text-sm text-app-secondary">{{ t('templates.subtitle') }}</p>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          v-for="{ template, text } in templates"
          :key="template.id"
          type="button"
          class="app-row w-full text-left"
          :data-template="template.id"
          @click="applyTemplate(template)"
        >
          <div class="flex items-start gap-3">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-app-mist text-app-ink" aria-hidden="true">
              <HugeiconsIcon :icon="templateIcons[template.icon]" :size="20" :stroke-width="1.8" />
            </span>
            <div class="min-w-0">
              <h3 class="font-semibold text-app-ink">{{ text.title }}</h3>
              <p class="mt-0.5 text-xs text-app-secondary">
                {{ recurrenceLabel(template) }} · {{ t('templates.before', { time: template.dueTime }) }} · {{ text.category }}
              </p>
            </div>
          </div>
        </button>
      </div>

      <h3 class="mt-8 text-sm font-semibold text-app-ink">{{ t('templates.packsTitle') }}</h3>
      <div class="mt-3 grid gap-3 sm:grid-cols-3">
        <div v-for="{ pack, text } in packs" :key="pack.id" class="app-sheet flex flex-col p-4">
          <p class="flex items-center gap-2 font-semibold text-app-ink">
            <HugeiconsIcon :icon="templateIcons[pack.icon]" :size="20" :stroke-width="1.8" aria-hidden="true" />
            {{ text.title }}
          </p>
          <p class="mt-1 flex-1 text-xs text-app-secondary">{{ text.description }}</p>
          <AppUiButton
            variant="secondary"
            class="mt-3"
            :loading="creatingPack === pack.id"
            :disabled="creatingPack !== null"
            @click="createPack(pack)"
          >
            {{ t('templates.addPack', pack.templateIds.length) }}
          </AppUiButton>
        </div>
      </div>
      <p v-if="error" class="mt-3 text-sm text-red-500">{{ error }}</p>
    </section>

    <div v-if="step === 1" class="mt-10 space-y-3">
      <h2 class="app-section-title">{{ t('templates.fromScratch') }}</h2>
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
        @click="startFromScratch(type.value as GoalKind)"
      >
        <h3 class="font-semibold text-app-ink">{{ type.label }}</h3>
        <p class="mt-1 text-sm text-app-secondary">{{ type.desc }}</p>
      </button>
    </div>

    <form v-if="step === 2" class="mt-8 max-w-lg space-y-5" @submit.prevent="handleSubmit">
      <p v-if="selectedTemplate" class="rounded-app-control bg-app-canvas px-4 py-3 text-sm text-app-secondary">
        {{ t('templates.prefilled', { title: localizeEntry(selectedTemplate, locale).title }) }}
        <template v-if="selectedTemplate.suggestedConsequence">
          <br>
          {{ t('templates.suggested', { consequence: consequenceLabel(selectedTemplate) }) }}
          <NuxtLink to="/app/reglages/consequences" class="font-semibold text-app-ink underline underline-offset-2">
            {{ t('templates.configure') }}
          </NuxtLink>
        </template>
      </p>

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

      <AppUiInput v-if="goalType !== 'project'" v-model="dueTime" :label="t('templates.dueTime')" type="time" required />

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
