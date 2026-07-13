<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'admin'] })

import { formatEuroFromCents } from '~/composables/useConsequences'

const { data, pending, refresh } = await useFetch('/api/admin/community-pot', {
  credentials: 'include',
})

const { data: connectData } = await useFetch('/api/admin/donations/connect', {
  credentials: 'include',
})

const monthlyGoalEuros = ref(500)
const targetAssociation = ref('msf')
const payoutPeriod = ref('')
const payoutAssociation = ref('msf')
const payoutAmountEuros = ref(0)
const payoutNotes = ref('')
const savingSettings = ref(false)
const savingPayout = ref(false)
const feedback = ref('')
const error = ref('')

watch(data, (value) => {
  if (!value) return
  monthlyGoalEuros.value = value.settings.monthlyGoalCents / 100
  targetAssociation.value = value.settings.targetAssociation
}, { immediate: true })

function currentPeriod() {
  const now = new Date()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${now.getUTCFullYear()}-${month}`
}

onMounted(() => {
  payoutPeriod.value = currentPeriod()
})

async function saveSettings() {
  savingSettings.value = true
  error.value = ''
  feedback.value = ''

  try {
    await $fetch('/api/admin/community-pot/settings', {
      method: 'PATCH',
      body: {
        monthlyGoalCents: Math.round(monthlyGoalEuros.value * 100),
        targetAssociation: targetAssociation.value,
      },
      credentials: 'include',
    })
    feedback.value = 'Objectif mensuel mis à jour.'
    await refresh()
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } }
    error.value = fetchError?.data?.message ?? 'Impossible de mettre à jour les réglages'
  } finally {
    savingSettings.value = false
  }
}

async function recordPayout() {
  savingPayout.value = true
  error.value = ''
  feedback.value = ''

  try {
    await $fetch('/api/admin/community-pot/payout', {
      method: 'POST',
      body: {
        period: payoutPeriod.value,
        association: payoutAssociation.value,
        amountCents: Math.round(payoutAmountEuros.value * 100),
        notes: payoutNotes.value || undefined,
      },
      credentials: 'include',
    })
    payoutNotes.value = ''
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
    <div class="mb-8">
      <h1 class="text-2xl font-semibold text-focus-gray-900">Cagnotte commune</h1>
      <p class="mt-1 text-sm text-focus-gray-500">
        Suivez la cagnotte, définissez l'objectif mensuel et enregistrez les reversements manuels vers une association.
      </p>
    </div>

    <div v-if="pending" class="focus-card h-40 animate-pulse bg-focus-gray-50" />

    <template v-else-if="data">
      <div class="grid gap-4 lg:grid-cols-3">
        <UiCard title="Solde actuel">
          <p class="text-3xl font-semibold text-focus-gray-900">
            {{ formatEuroFromCents(data.stats.balanceCents) }}
          </p>
          <p class="mt-1 text-sm text-focus-gray-500">
            {{ data.stats.transactionCount }} contribution{{ data.stats.transactionCount > 1 ? 's' : '' }}
          </p>
        </UiCard>

        <UiCard title="Ce mois-ci">
          <p class="text-3xl font-semibold text-focus-accent">
            {{ formatEuroFromCents(data.stats.monthCents) }}
          </p>
          <p class="mt-1 text-sm text-focus-gray-500">
            Objectif : {{ formatEuroFromCents(data.stats.monthlyGoalCents) }}
          </p>
        </UiCard>

        <UiCard title="Association cible">
          <p class="text-xl font-semibold text-focus-gray-900">
            {{ data.stats.targetAssociationLabel }}
          </p>
          <p class="mt-1 text-sm text-focus-gray-500">
            Reversement manuel en fin de mois
          </p>
        </UiCard>
      </div>

      <UiCard title="Stripe Connect (dons)" class="mt-6">
        <p class="mb-4 text-sm text-focus-gray-500">
          Chaque association doit avoir un compte connecté Stripe (<code class="text-xs">acct_...</code>)
          dans les variables d'environnement. Vérifiez la configuration ici.
        </p>
        <div class="space-y-2">
          <div
            v-for="association in connectData?.associations ?? []"
            :key="association.value"
            class="flex flex-wrap items-center justify-between gap-3 rounded-focus border border-focus-gray-100 px-4 py-3 text-sm"
          >
            <div>
              <p class="font-medium text-focus-gray-900">{{ association.label }}</p>
              <p class="text-xs text-focus-gray-400">{{ association.connectEnvKey }}</p>
            </div>
            <UiBadge :variant="association.configured ? 'success' : 'neutral'">
              {{ association.configured ? `Connecté ••••${association.accountIdSuffix}` : 'Non configuré' }}
            </UiBadge>
          </div>
        </div>
      </UiCard>

      <UiCard title="Objectif mensuel" class="mt-6">
        <form class="grid gap-4 md:grid-cols-2" @submit.prevent="saveSettings">
          <UiInput
            v-model.number="monthlyGoalEuros"
            label="Objectif (€)"
            type="number"
            min="1"
            step="1"
          />
          <UiSelect v-model="targetAssociation" label="Association cible">
            <option
              v-for="association in data.associations"
              :key="association.value"
              :value="association.value"
            >
              {{ association.label }}
            </option>
          </UiSelect>
          <div class="md:col-span-2">
            <UiButton type="submit" :loading="savingSettings">
              Enregistrer l'objectif
            </UiButton>
          </div>
        </form>
      </UiCard>

      <UiCard title="Reversement manuel" class="mt-6">
        <p class="mb-4 text-sm text-focus-gray-500">
          Après avoir effectué le virement bancaire vers l'association, enregistrez-le ici pour mettre à jour le solde de la cagnotte.
        </p>
        <form class="grid gap-4 md:grid-cols-2" @submit.prevent="recordPayout">
          <UiInput v-model="payoutPeriod" label="Période (AAAA-MM)" placeholder="2026-07" />
          <UiInput
            v-model.number="payoutAmountEuros"
            label="Montant reversé (€)"
            type="number"
            min="0.01"
            step="0.01"
          />
          <UiSelect v-model="payoutAssociation" label="Association">
            <option
              v-for="association in data.associations"
              :key="association.value"
              :value="association.value"
            >
              {{ association.label }}
            </option>
          </UiSelect>
          <UiInput v-model="payoutNotes" label="Notes (optionnel)" placeholder="Référence virement, preuve..." />
          <div class="md:col-span-2">
            <UiButton type="submit" variant="secondary" :loading="savingPayout">
              Enregistrer le reversement
            </UiButton>
          </div>
        </form>
      </UiCard>

      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <UiCard title="Dernières contributions">
          <div v-if="!data.recentTransactions.length" class="text-sm text-focus-gray-400">
            Aucune contribution pour le moment.
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="transaction in data.recentTransactions"
              :key="transaction.id"
              class="flex items-center justify-between rounded-focus border border-focus-gray-100 px-4 py-3 text-sm"
            >
              <div>
                <p class="font-medium text-focus-gray-900">{{ transaction.displayName }}</p>
                <p class="text-xs text-focus-gray-400">
                  {{ new Date(transaction.createdAt).toLocaleDateString('fr-FR') }}
                </p>
              </div>
              <span class="font-semibold text-focus-gray-900">
                {{ formatEuroFromCents(transaction.amount) }}
              </span>
            </div>
          </div>
        </UiCard>

        <UiCard title="Reversements enregistrés">
          <div v-if="!data.payouts.length" class="text-sm text-focus-gray-400">
            Aucun reversement enregistré.
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="payout in data.payouts"
              :key="payout.id"
              class="rounded-focus border border-focus-gray-100 px-4 py-3 text-sm"
            >
              <div class="flex items-center justify-between gap-3">
                <p class="font-medium text-focus-gray-900">{{ payout.period }}</p>
                <span class="font-semibold">{{ formatEuroFromCents(payout.amount) }}</span>
              </div>
              <p class="mt-1 text-xs text-focus-gray-400">
                {{ payout.association }}
                <span v-if="payout.notes"> — {{ payout.notes }}</span>
              </p>
            </div>
          </div>
        </UiCard>
      </div>

      <div class="mt-6 flex flex-wrap items-center gap-3">
        <p v-if="feedback" class="text-sm text-emerald-600">{{ feedback }}</p>
        <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
      </div>
    </template>
  </div>
</template>
