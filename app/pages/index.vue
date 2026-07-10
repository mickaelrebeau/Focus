<script setup lang="ts">
const landingRef = ref<HTMLElement | null>(null)
useLandingMotion(landingRef)

const useCases = [
  { icon: '𝕏', title: 'Réseaux sociaux', description: 'Publiez un post sur X chaque jour et tenez le rythme.' },
  { icon: '◈', title: 'Projets créatifs', description: 'Suivez l\'avancement de vos projets dev, design ou jeux vidéo.' },
  { icon: '◎', title: 'Sport & santé', description: 'Faites du sport 3 fois par semaine, sans exception.' },
  { icon: '◷', title: 'Habitudes quotidiennes', description: 'Méditation, lecture, apprentissage — chaque jour compte.' },
  { icon: '▲', title: 'Classement', description: 'Comparez votre score net avec la communauté Focus.' },
  { icon: '◫', title: 'Historique complet', description: 'Retracez chaque crédit gagné, perdu ou remboursé.' },
]
</script>

<template>
  <div ref="landingRef">
    <!-- Hero -->
    <section class="relative overflow-hidden py-20 md:py-32">
      <div class="focus-container text-center">
        <div class="landing-hero-subtitle mb-8 flex justify-center">
          <AppLogo to="/" size="lg" :show-label="false" />
        </div>
        <p class="landing-hero-subtitle focus-label mb-6">Objectifs. Responsabilité. Résultats.</p>
        <h1 class="landing-hero-title focus-heading-xl text-balance mx-auto max-w-4xl">
          Tenez vos engagements.<br>Gagnez en crédits.
        </h1>
        <p class="landing-hero-subtitle focus-body mx-auto mt-6 max-w-2xl text-lg">
          Focus transforme vos objectifs en engagements concrets. Réussissez et gagnez des crédits.
          Échouez, et 20 crédits sont débités — ou ajoutés à votre dette.
        </p>
        <div class="landing-hero-cta mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <NuxtLink to="/inscription" class="focus-btn-primary px-8">
            Commencer gratuitement
          </NuxtLink>
          <NuxtLink to="/connexion" class="focus-btn-secondary px-8">
            Se connecter
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- App preview mockup -->
    <section class="py-16 md:py-24">
      <div class="focus-container">
        <div class="landing-mockup mx-auto max-w-sm rounded-focus-xl border border-focus-gray-200 bg-focus-white p-6 shadow-focus-lg md:max-w-md">
          <div class="mb-4 flex items-center justify-between">
            <span class="text-sm font-semibold text-focus-gray-900">Aujourd'hui</span>
            <span class="text-sm font-semibold text-focus-gray-900">120 crédits</span>
          </div>
          <div class="space-y-3">
            <div class="rounded-focus border border-focus-gray-100 p-4">
              <div class="flex items-center justify-between">
                <UiBadge variant="neutral">À faire</UiBadge>
                <span class="text-xs text-focus-gray-400">+10</span>
              </div>
              <p class="mt-2 font-medium text-focus-gray-900">Publier sur X</p>
              <p class="text-xs text-focus-gray-400">Quotidien · Réseaux sociaux</p>
            </div>
            <div class="rounded-focus border border-focus-gray-100 p-4">
              <div class="flex items-center justify-between">
                <UiBadge variant="success">Réussi</UiBadge>
                <span class="text-xs text-emerald-600">+10</span>
              </div>
              <p class="mt-2 font-medium text-focus-gray-900">Séance de sport</p>
              <p class="text-xs text-focus-gray-400">3× par semaine · Santé</p>
            </div>
            <div class="rounded-focus border border-focus-gray-100 p-4">
              <div class="flex items-center justify-between">
                <UiBadge variant="warning">Jalon</UiBadge>
                <span class="text-xs text-focus-gray-400">+10</span>
              </div>
              <p class="mt-2 font-medium text-focus-gray-900">Prototype v1</p>
              <p class="text-xs text-focus-gray-400">Projet · Développement</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section class="border-t border-focus-gray-100 py-20 md:py-28">
      <div class="focus-container">
        <h2 class="landing-reveal focus-heading-lg text-center">Comment ça marche</h2>
        <div class="mt-16 grid gap-8 md:grid-cols-3">
          <div class="landing-reveal text-center">
            <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-focus-gray-100 text-lg font-semibold">1</div>
            <h3 class="font-semibold text-focus-gray-900">Définissez</h3>
            <p class="focus-body-sm mt-2">Créez des objectifs récurrents, ponctuels ou des projets à jalons.</p>
          </div>
          <div class="landing-reveal text-center">
            <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-focus-gray-100 text-lg font-semibold">2</div>
            <h3 class="font-semibold text-focus-gray-900">Réalisez</h3>
            <p class="focus-body-sm mt-2">Validez chaque échéance avec une note ou une preuve facultative.</p>
          </div>
          <div class="landing-reveal text-center">
            <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-focus-gray-100 text-lg font-semibold">3</div>
            <h3 class="font-semibold text-focus-gray-900">Progressez</h3>
            <p class="focus-body-sm mt-2">Gagnez +10 crédits par réussite. Échouez, perdez 20 — ou créez une dette.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Use cases -->
    <section class="bg-focus-gray-50 py-20 md:py-28">
      <div class="focus-container">
        <h2 class="landing-reveal focus-heading-lg text-center">Pour tous vos objectifs</h2>
        <div class="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div v-for="useCase in useCases" :key="useCase.title" class="landing-reveal focus-card">
            <span class="text-2xl">{{ useCase.icon }}</span>
            <h3 class="mt-3 font-semibold text-focus-gray-900">{{ useCase.title }}</h3>
            <p class="focus-body-sm mt-2">{{ useCase.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Credits system -->
    <section class="py-20 md:py-28">
      <div class="focus-container-narrow text-center">
        <h2 class="landing-reveal focus-heading-lg">Un système de crédits transparent</h2>
        <p class="landing-reveal focus-body mt-4">
          Chaque réussite rapporte 10 crédits. Chaque échec coûte 20 crédits.
          Si votre solde est insuffisant, le reliquat devient une dette à rembourser
          avec vos prochaines réussites. Grimpez au classement avec votre score net.
        </p>
        <div class="landing-reveal mt-10 flex justify-center gap-8">
          <div class="text-center">
            <p class="text-3xl font-semibold text-emerald-600">+10</p>
            <p class="text-sm text-focus-gray-400">par réussite</p>
          </div>
          <div class="text-center">
            <p class="text-3xl font-semibold text-red-500">-20</p>
            <p class="text-sm text-focus-gray-400">par échec</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="border-t border-focus-gray-100 py-20 md:py-28">
      <div class="focus-container text-center">
        <h2 class="landing-reveal focus-heading-lg">Prêt à vous engager ?</h2>
        <p class="landing-reveal focus-body mt-4">Rejoignez Focus et transformez vos intentions en résultats.</p>
        <NuxtLink to="/inscription" class="landing-reveal focus-btn-primary mt-8 inline-flex px-8">
          Créer mon compte
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
