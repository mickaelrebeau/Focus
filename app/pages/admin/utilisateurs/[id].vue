<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'admin'] })

const route = useRoute()
const id = route.params.id as string
const { data, refresh } = useFetch(() => `/api/admin/users/${id}`)

const adjustAmount = ref(0)
const adjustReason = ref('')
const loading = ref(false)

async function toggleBlock() {
  await $fetch(`/api/admin/users/${id}`, {
    method: 'PATCH',
    body: { isBlocked: !data.value?.user.isBlocked },
  })
  await refresh()
}

async function adjustCredits() {
  loading.value = true
  await $fetch(`/api/admin/users/${id}`, {
    method: 'POST',
    body: { amount: adjustAmount.value, reason: adjustReason.value },
  })
  adjustAmount.value = 0
  adjustReason.value = ''
  await refresh()
  loading.value = false
}
</script>

<template>
  <div v-if="data">
    <NuxtLink to="/admin/utilisateurs" class="text-sm text-focus-gray-400">← Utilisateurs</NuxtLink>
    <h1 class="focus-heading-lg mt-4">{{ data.user.displayName }}</h1>
    <p class="text-focus-gray-500">{{ data.user.email }}</p>

    <div class="mt-6 flex gap-6">
      <div>
        <p class="text-2xl font-semibold">{{ data.user.balance }}</p>
        <p class="text-xs text-focus-gray-400">Crédits</p>
      </div>
      <div>
        <p class="text-2xl font-semibold text-red-500">{{ data.user.debt }}</p>
        <p class="text-xs text-focus-gray-400">Dette</p>
      </div>
    </div>

    <div class="mt-8 flex gap-3">
      <UiButton variant="secondary" @click="toggleBlock">
        {{ data.user.isBlocked ? 'Débloquer' : 'Bloquer' }}
      </UiButton>
    </div>

    <UiCard title="Ajustement de crédits" class="mt-8 max-w-md">
      <div class="space-y-4">
        <UiInput v-model="adjustAmount" label="Montant (+/-)" type="number" />
        <UiInput v-model="adjustReason" label="Motif" required />
        <UiButton :loading="loading" @click="adjustCredits">Appliquer</UiButton>
      </div>
    </UiCard>

    <div class="mt-8">
      <h2 class="focus-heading-md">Historique crédits</h2>
      <div class="mt-4 space-y-2">
        <div v-for="entry in data.ledger" :key="entry.id" class="flex justify-between text-sm">
          <span>{{ entry.type }} — {{ entry.reason ?? '' }}</span>
          <span :class="entry.amount >= 0 ? 'text-emerald-600' : 'text-red-500'">
            {{ entry.amount >= 0 ? '+' : '' }}{{ entry.amount }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
