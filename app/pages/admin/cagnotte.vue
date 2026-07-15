<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'admin'] })

import { formatEuroFromCents } from '~/composables/useConsequences'

interface AdminAssociation {
  id: string
  slug: string
  name: string
  description: string | null
  logoUrl: string | null
  enabled: boolean
  sortOrder: number
  collectedCents: number
  paidOutCents: number
  balanceCents: number
  monthCents: number
  contributionCount: number
}

const { data, pending, refresh } = await useFetch<{
  associations: AdminAssociation[]
  payouts: Array<{
    id: string
    associationSlug: string
    period: string
    amount: number
    notes: string | null
    createdAt: string
  }>
}>('/api/admin/associations', {
  credentials: 'include',
})

const selectedSlug = ref('')
const editingAssociation = ref<AdminAssociation | null>(null)
const creating = ref(false)

const newAssociation = ref({
  slug: '',
  name: '',
  description: '',
  logoUrl: '',
  enabled: true,
  sortOrder: 0,
})

const payoutPeriod = ref('')
const payoutAmountEuros = ref(0)
const payoutNotes = ref('')
const savingPayout = ref(false)
const savingAssociation = ref(false)
const feedback = ref('')
const error = ref('')

watch(data, (value) => {
  if (!value?.associations.length) return
  if (!selectedSlug.value) {
    selectedSlug.value = value.associations[0].slug
  }
}, { immediate: true })

watch(selectedSlug, (slug) => {
  const association = data.value?.associations.find(item => item.slug === slug)
  if (association) {
    editingAssociation.value = {
      ...association,
      description: association.description ?? '',
      logoUrl: association.logoUrl ?? '',
    }
  }
})

function currentPeriod() {
  const now = new Date()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${now.getUTCFullYear()}-${month}`
}

onMounted(() => {
  payoutPeriod.value = currentPeriod()
})

const selectedAssociation = computed(() =>
  data.value?.associations.find(item => item.slug === selectedSlug.value),
)

async function saveAssociation() {
  if (!editingAssociation.value) return

  savingAssociation.value = true
  error.value = ''
  feedback.value = ''

  try {
    await $fetch(`/api/admin/associations/${editingAssociation.value.slug}`, {
      method: 'PATCH',
      body: {
        name: editingAssociation.value.name,
        description: editingAssociation.value.description || null,
        logoUrl: editingAssociation.value.logoUrl || null,
        enabled: editingAssociation.value.enabled,
        sortOrder: editingAssociation.value.sortOrder,
      },
      credentials: 'include',
    })
    feedback.value = 'Association mise à jour.'
    await refresh()
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } }
    error.value = fetchError?.data?.message ?? 'Impossible de mettre à jour l\'association'
  } finally {
    savingAssociation.value = false
  }
}

async function createAssociation() {
  savingAssociation.value = true
  error.value = ''
  feedback.value = ''

  try {
    await $fetch('/api/admin/associations', {
      method: 'POST',
      body: {
        slug: newAssociation.value.slug,
        name: newAssociation.value.name,
        description: newAssociation.value.description || undefined,
        logoUrl: newAssociation.value.logoUrl || undefined,
        enabled: newAssociation.value.enabled,
        sortOrder: newAssociation.value.sortOrder,
      },
      credentials: 'include',
    })
    creating.value = false
    newAssociation.value = { slug: '', name: '', description: '', logoUrl: '', enabled: true, sortOrder: 0 }
    feedback.value = 'Association créée.'
    await refresh()
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } }
    error.value = fetchError?.data?.message ?? 'Impossible de créer l\'association'
  } finally {
    savingAssociation.value = false
  }
}

async function recordPayout() {
  if (!selectedSlug.value) return

  savingPayout.value = true
  error.value = ''
  feedback.value = ''

  try {
    await $fetch(`/api/admin/associations/${selectedSlug.value}/payout`, {
      method: 'POST',
      body: {
        period: payoutPeriod.value,
        amountCents: Math.round(payoutAmountEuros.value * 100),
        notes: payoutNotes.value || undefined,
      },
      credentials: 'include',
    })
    payoutNotes.value = ''
    payoutAmountEuros.value = 0
    feedback.value = 'Reversement enregistré.'
    await refresh()
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } }
    error.value = fetchError?.data?.message ?? 'Impossible d\'enregistrer le reversement'
  } finally {
    savingPayout.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold text-focus-gray-900">Cagnottes associatives</h1>
        <p class="mt-1 text-sm text-focus-gray-500">
          Gérez les associations, consultez les soldes et enregistrez les reversements mensuels.
        </p>
      </div>
      <UiButton variant="secondary" @click="creating = !creating">
        {{ creating ? 'Annuler' : 'Nouvelle association' }}
      </UiButton>
    </div>

    <UiCard v-if="creating" title="Créer une association" class="mb-6">
      <form class="grid gap-4 md:grid-cols-2" @submit.prevent="createAssociation">
        <UiInput v-model="newAssociation.slug" label="Slug" placeholder="mon-asso" />
        <UiInput v-model="newAssociation.name" label="Nom" />
        <UiInput v-model="newAssociation.description" label="Description" class="md:col-span-2" />
        <UiInput v-model="newAssociation.logoUrl" label="URL du logo (optionnel)" class="md:col-span-2" />
        <UiInput v-model.number="newAssociation.sortOrder" label="Ordre d'affichage" type="number" min="0" />
        <div class="flex items-end">
          <UiToggle v-model="newAssociation.enabled" label="Active" />
        </div>
        <div class="md:col-span-2">
          <UiButton type="submit" :loading="savingAssociation">Créer</UiButton>
        </div>
      </form>
    </UiCard>

    <div v-if="pending" class="focus-card h-40 animate-pulse bg-focus-gray-50" />

    <template v-else-if="data">
      <div class="grid gap-4 lg:grid-cols-3">
        <UiCard
          v-for="association in data.associations"
          :key="association.slug"
          class="cursor-pointer transition hover:border-focus-accent"
          :class="{ 'border-focus-accent': selectedSlug === association.slug }"
          @click="selectedSlug = association.slug"
        >
          <div class="mb-3 flex items-center gap-3">
            <AssociationLogo
              :name="association.name"
              :logo-url="association.logoUrl"
              size="md"
            />
            <div class="min-w-0">
              <h3 class="truncate font-semibold text-focus-gray-900">{{ association.name }}</h3>
              <UiBadge :variant="association.enabled ? 'success' : 'neutral'" class="mt-1">
                {{ association.enabled ? 'Active' : 'Inactive' }}
              </UiBadge>
            </div>
          </div>
          <p class="text-3xl font-semibold text-focus-gray-900">
            {{ formatEuroFromCents(association.balanceCents) }}
          </p>
          <p class="mt-1 text-sm text-focus-gray-500">
            Collecté {{ formatEuroFromCents(association.collectedCents) }} ·
            Reversé {{ formatEuroFromCents(association.paidOutCents) }}
          </p>
          <p class="mt-1 text-sm text-focus-accent">
            Ce mois : {{ formatEuroFromCents(association.monthCents) }}
          </p>
        </UiCard>
      </div>

      <div v-if="editingAssociation" class="mt-6 grid gap-6 lg:grid-cols-2">
        <UiCard title="Modifier l'association">
          <form class="space-y-4" @submit.prevent="saveAssociation">
            <div
              v-if="editingAssociation.logoUrl"
              class="flex items-center gap-3 rounded-focus border border-focus-gray-100 bg-focus-gray-50 px-4 py-3"
            >
              <AssociationLogo
                :name="editingAssociation.name"
                :logo-url="editingAssociation.logoUrl"
                size="md"
              />
              <p class="text-sm text-focus-gray-500">Aperçu du logo</p>
            </div>
            <UiInput v-model="editingAssociation.name" label="Nom" />
            <UiInput v-model="editingAssociation.description" label="Description" />
            <UiInput v-model="editingAssociation.logoUrl" label="URL du logo" />
            <UiInput v-model.number="editingAssociation.sortOrder" label="Ordre" type="number" min="0" />
            <UiToggle v-model="editingAssociation.enabled" label="Active" />
            <UiButton type="submit" :loading="savingAssociation">Enregistrer</UiButton>
          </form>
        </UiCard>

        <UiCard title="Reversement manuel">
          <p class="mb-4 text-sm text-focus-gray-500">
            Solde disponible :
            <strong>{{ formatEuroFromCents(selectedAssociation?.balanceCents ?? 0) }}</strong>
          </p>
          <form class="space-y-4" @submit.prevent="recordPayout">
            <UiInput v-model="payoutPeriod" label="Période (AAAA-MM)" />
            <UiInput
              v-model.number="payoutAmountEuros"
              label="Montant reversé (€)"
              type="number"
              min="0.01"
              step="0.01"
            />
            <UiInput v-model="payoutNotes" label="Notes (optionnel)" />
            <UiButton type="submit" variant="secondary" :loading="savingPayout">
              Enregistrer le reversement
            </UiButton>
          </form>
        </UiCard>
      </div>

      <UiCard title="Historique des reversements" class="mt-6">
        <div v-if="!data.payouts.length" class="text-sm text-focus-gray-400">
          Aucun reversement enregistré.
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="payout in data.payouts"
            :key="payout.id"
            class="flex flex-wrap items-center justify-between gap-3 rounded-focus border border-focus-gray-100 px-4 py-3 text-sm"
          >
            <div>
              <p class="font-medium text-focus-gray-900">{{ payout.associationSlug }} — {{ payout.period }}</p>
              <p v-if="payout.notes" class="text-xs text-focus-gray-400">{{ payout.notes }}</p>
            </div>
            <span class="font-semibold">{{ formatEuroFromCents(payout.amount) }}</span>
          </div>
        </div>
      </UiCard>

      <div class="mt-6 flex flex-wrap items-center gap-3">
        <p v-if="feedback" class="text-sm text-emerald-600">{{ feedback }}</p>
        <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
        <NuxtLink to="/cagnottes" class="text-sm font-medium text-focus-accent hover:opacity-80">
          Voir la page publique →
        </NuxtLink>
      </div>
    </template>
  </div>
</template>
