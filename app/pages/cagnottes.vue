<script setup lang="ts">
definePageMeta({ middleware: 'public-app-layout' })

import { formatEuroFromCents } from '~/composables/useConsequences'

const { data, pending } = await useFetch('/api/cagnottes')
</script>

<template>
  <div class="p-4 sm:p-5 md:p-8">
    <div class="focus-container max-w-none py-2 md:py-4">
    <div class="max-w-3xl">
      <p class="focus-label">Transparence</p>
      <h1 class="focus-heading-lg mt-2">Cagnottes associatives</h1>
      <p class="focus-body mt-3 text-focus-gray-500">
        Chaque don issu d'une conséquence monétaire est cumulé sur le compte Stripe de la plateforme,
        puis reversé manuellement chaque mois à l'association concernée.
      </p>
    </div>

    <div v-if="pending" class="mt-10 grid gap-4 md:grid-cols-2">
      <div v-for="i in 4" :key="i" class="focus-card h-48 animate-pulse bg-focus-gray-50" />
    </div>

    <div v-else class="mt-10 grid gap-6 md:grid-cols-2">
      <UiCard
        v-for="association in data?.associations ?? []"
        :key="association.slug"
      >
        <div class="mb-4 flex items-center gap-3">
          <AssociationLogo
            :name="association.name"
            :logo-url="association.logoUrl"
            size="lg"
          />
          <div class="min-w-0">
            <h3 class="focus-heading-md truncate">{{ association.name }}</h3>
            <p v-if="association.description" class="mt-1 text-sm text-focus-gray-500 line-clamp-2">
              {{ association.description }}
            </p>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <p class="text-xs uppercase tracking-wide text-focus-gray-400">Solde disponible</p>
            <p class="mt-1 text-2xl font-semibold text-focus-gray-900">
              {{ formatEuroFromCents(association.balanceCents) }}
            </p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-focus-gray-400">Ce mois-ci</p>
            <p class="mt-1 text-2xl font-semibold text-focus-accent">
              {{ formatEuroFromCents(association.monthCents) }}
            </p>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-4 text-sm text-focus-gray-500">
          <span>Collecté : {{ formatEuroFromCents(association.collectedCents) }}</span>
          <span>Reversé : {{ formatEuroFromCents(association.paidOutCents) }}</span>
          <span>{{ association.contributionCount }} contribution{{ association.contributionCount > 1 ? 's' : '' }}</span>
        </div>

        <div v-if="association.payouts.length" class="mt-6 border-t border-focus-gray-100 pt-4">
          <p class="text-xs font-medium uppercase tracking-wide text-focus-gray-400">Reversements récents</p>
          <div class="mt-3 space-y-2">
            <div
              v-for="(payout, index) in association.payouts.slice(0, 5)"
              :key="`${association.slug}-${payout.period}-${index}`"
              class="flex items-center justify-between text-sm"
            >
              <span class="text-focus-gray-600">{{ payout.period }}</span>
              <span class="font-medium text-focus-gray-900">{{ formatEuroFromCents(payout.amount) }}</span>
            </div>
          </div>
        </div>
      </UiCard>
    </div>

    <p v-if="data?.updatedAt" class="mt-8 text-xs text-focus-gray-400">
      Dernière mise à jour : {{ new Date(data.updatedAt).toLocaleString('fr-FR') }}
    </p>
    </div>
  </div>
</template>
