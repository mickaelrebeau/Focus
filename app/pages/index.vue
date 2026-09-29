<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue'
import {
  Analytics01Icon,
  ArrowRight01Icon,
  Camera01Icon,
  CheckmarkBadge01Icon,
  Coins01Icon,
  FavouriteIcon,
  FireIcon,
  GithubIcon,
  Mail01Icon,
  PauseIcon,
  UserMultiple02Icon,
} from '@hugeicons/core-free-icons'

const landingRef = ref<HTMLElement | null>(null)
useLandingMotion(landingRef)

// Titre révélé mot par mot (voir useLandingMotion)
const heroLines = [['Tenez', 'vos', 'engagements.'], ['Pour', 'de', 'vrai.']]

const useCases = [
  'Publier chaque jour', 'Sport 3× par semaine', 'Lire 20 pages', 'Méditer 10 minutes',
  'Écrire 500 mots', 'Livrer un prototype', 'Apprendre une langue', 'Couper les écrans à 22 h',
]

const consequences = [
  { icon: Coins01Icon, label: 'Perte de crédits' },
  { icon: FavouriteIcon, label: 'Don à une association' },
  { icon: Mail01Icon, label: 'Message à un proche' },
  { icon: Camera01Icon, label: 'Preuve obligatoire' },
]

const ledger = [
  { label: 'Séance de sport', amount: '+10', positive: true },
  { label: 'Publier sur X', amount: '+10', positive: true },
  { label: 'Lecture du soir', amount: '−20', positive: false },
]

// Score net de la semaine (illustratif) : barres de la tuile crédits
const week = [
  { day: 'L', value: 20 }, { day: 'M', value: 30 }, { day: 'M', value: 10 }, { day: 'J', value: 40 },
  { day: 'V', value: 25 }, { day: 'S', value: 50 }, { day: 'D', value: 60 },
]

const steps = [
  { title: 'Engagez-vous', text: 'Un objectif, une fréquence, une heure limite. Ou un modèle prêt à l\'emploi.' },
  { title: 'Validez', text: 'Cochez avant l\'heure limite, avec une preuve si vous le souhaitez.' },
  { title: 'Assumez', text: 'Réussite : des crédits. Échec : la conséquence que vous avez choisie.' },
]
</script>

<template>
  <div ref="landingRef" class="landing">
    <!-- Hero -->
    <section class="landing-hero relative overflow-hidden">
      <div class="landing-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div class="focus-container relative pb-16 pt-20 text-center md:pb-24 md:pt-32">
        <h1 class="focus-heading-xl mx-auto mt-8 max-w-4xl text-balance md:text-7xl md:leading-[1.02]">
          <span v-for="(line, lineIndex) in heroLines" :key="lineIndex" class="block" :class="{ 'text-focus-gray-400': lineIndex === 1 }">
            <span v-for="word in line" :key="word" class="landing-word-mask">
              <span class="landing-word">{{ word }}</span>
            </span>
          </span>
        </h1>
        <p class="landing-hero-fade focus-body mx-auto mt-6 max-w-xl text-lg">
          Focus transforme vos objectifs en engagements. Réussissez, gagnez des crédits.
          Échouez, et la conséquence que vous avez choisie s'applique.
        </p>
        <div class="landing-hero-fade mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <NuxtLink to="/inscription" class="focus-btn-primary group px-7">
            Commencer gratuitement
            <HugeiconsIcon :icon="ArrowRight01Icon" :size="16" :stroke-width="2" class="transition group-hover:translate-x-0.5" aria-hidden="true" />
          </NuxtLink>
          <NuxtLink to="/connexion" class="focus-btn-ghost px-7">Se connecter</NuxtLink>
        </div>

        <!-- Aperçu : une échéance se coche quand la carte entre à l'écran -->
        <div class="landing-preview relative mx-auto mt-16 max-w-md text-left md:mt-20" data-testid="landing-preview">
          <div class="rounded-[28px] border border-focus-gray-200 bg-focus-white p-5 shadow-focus-lg">
            <div class="flex items-center justify-between px-1">
              <span class="text-sm font-semibold text-focus-gray-900">Aujourd'hui</span>
              <span class="rounded-full bg-focus-gray-100 px-2.5 py-1 text-xs font-semibold text-focus-gray-900">
                <span class="landing-credits tabular-nums" data-from="110" data-to="120">120</span> crédits
              </span>
            </div>
            <div class="mt-4 space-y-2.5">
              <div class="landing-task flex items-center gap-3 rounded-2xl border border-focus-gray-100 p-3.5">
                <span class="landing-check relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-focus-gray-200">
                  <svg viewBox="0 0 24 24" class="h-4 w-4 text-focus-white" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
                    <path class="landing-check-path" d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </span>
                <div class="min-w-0 flex-1">
                  <p class="landing-task-title font-medium text-focus-gray-900">Publier sur X</p>
                  <p class="text-xs text-focus-gray-400">Tous les jours · avant 12:00</p>
                </div>
                <span class="text-xs font-semibold text-emerald-600">+10</span>
              </div>
              <div class="flex items-center gap-3 rounded-2xl border border-focus-gray-100 p-3.5">
                <span class="h-9 w-9 shrink-0 rounded-full border-2 border-focus-gray-200" />
                <div class="min-w-0 flex-1">
                  <p class="font-medium text-focus-gray-900">Séance de sport</p>
                  <p class="text-xs text-focus-gray-400">3× par semaine · avant 20:00</p>
                </div>
                <span class="text-xs text-focus-gray-400">+10 / −20</span>
              </div>
              <div class="flex items-center gap-3 rounded-2xl border border-focus-gray-100 p-3.5">
                <span class="h-9 w-9 shrink-0 rounded-full border-2 border-dashed border-focus-gray-200" />
                <div class="min-w-0 flex-1">
                  <p class="font-medium text-focus-gray-900">Prototype v1</p>
                  <p class="text-xs text-focus-gray-400">Projet · jalon 2 sur 3</p>
                </div>
                <span class="focus-badge-neutral">Jalon</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Bento : les fonctionnalités -->
    <section class="py-20 md:py-28">
      <div class="focus-container">
        <div class="mx-auto max-w-2xl text-center">
          <p class="landing-reveal focus-label">Fonctionnalités</p>
          <h2 class="landing-reveal focus-heading-lg mt-3 md:text-4xl">Tout pour tenir parole</h2>
        </div>

        <div class="landing-bento mt-12 grid gap-3 md:mt-16 md:grid-cols-6 md:gap-4">
          <!-- Crédits : tuile principale -->
          <article class="landing-tile bento-tile md:col-span-4 md:row-span-2">
            <div class="flex h-full flex-col">
              <HugeiconsIcon :icon="Coins01Icon" :size="22" :stroke-width="1.8" class="text-focus-gray-900" aria-hidden="true" />
              <h3 class="mt-4 text-lg font-semibold text-focus-gray-900">Des crédits en jeu</h3>
              <p class="focus-body-sm mt-1 max-w-sm">Chaque réussite rapporte, chaque échec coûte. Solde insuffisant ? Le reste devient une dette, remboursée par vos prochaines réussites.</p>
              <div class="mt-8 hidden flex-1 items-end gap-2 md:flex" aria-hidden="true">
                <div v-for="(bar, index) in week" :key="index" class="flex flex-1 flex-col items-center gap-2">
                  <div class="flex h-28 w-full items-end">
                    <div class="landing-bar w-full origin-bottom rounded-lg" :class="index === week.length - 1 ? 'bg-focus-gray-900' : 'bg-focus-gray-100'" :style="{ height: `${bar.value / 60 * 100}%` }" />
                  </div>
                  <span class="text-[11px] text-focus-gray-400">{{ bar.day }}</span>
                </div>
              </div>
              <div class="mt-8 grid items-end gap-6 sm:grid-cols-2">
                <div class="flex items-baseline gap-6">
                  <p><span class="block text-5xl font-semibold tracking-tight text-emerald-600 md:text-6xl">+10</span><span class="text-xs text-focus-gray-400">par réussite</span></p>
                  <p><span class="block text-5xl font-semibold tracking-tight text-focus-gray-900 md:text-6xl">−20</span><span class="text-xs text-focus-gray-400">par échec</span></p>
                </div>
                <ul class="space-y-2" aria-label="Exemple d'historique de crédits">
                  <li v-for="entry in ledger" :key="entry.label" class="landing-ledger flex items-center justify-between rounded-xl bg-focus-gray-50 px-3.5 py-2.5 text-sm">
                    <span class="text-focus-gray-700">{{ entry.label }}</span>
                    <span class="font-semibold tabular-nums" :class="entry.positive ? 'text-emerald-600' : 'text-focus-gray-900'">{{ entry.amount }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </article>

          <!-- Streak -->
          <article class="landing-tile bento-tile md:col-span-2">
            <HugeiconsIcon :icon="FireIcon" :size="22" :stroke-width="1.8" class="text-focus-gray-900" aria-hidden="true" />
            <p class="mt-4 text-4xl font-semibold tracking-tight text-focus-gray-900"><span class="landing-count tabular-nums" data-to="12">12</span> jours</p>
            <p class="focus-body-sm mt-1">de série, avec un bonus tous les 7 jours.</p>
            <div class="mt-5 flex gap-1.5" aria-hidden="true">
              <span v-for="day in 7" :key="day" class="landing-dot h-2 flex-1 rounded-full" :class="day <= 5 ? 'bg-focus-gray-900' : 'bg-focus-gray-200'" />
            </div>
          </article>

          <!-- Conséquences -->
          <article class="landing-tile bento-tile md:col-span-2">
            <h3 class="text-lg font-semibold text-focus-gray-900">Vos conséquences</h3>
            <p class="focus-body-sm mt-1">Vous choisissez ce qui arrive en cas d'échec.</p>
            <ul class="mt-4 flex flex-wrap gap-2">
              <li v-for="item in consequences" :key="item.label" class="inline-flex items-center gap-1.5 rounded-full border border-focus-gray-200 px-3 py-1.5 text-xs font-medium text-focus-gray-700">
                <HugeiconsIcon :icon="item.icon" :size="14" :stroke-width="1.8" aria-hidden="true" />
                {{ item.label }}
              </li>
            </ul>
          </article>

          <!-- Cas d'usage : bande qui défile -->
          <article class="landing-tile bento-tile overflow-hidden !px-0 md:col-span-4">
            <h3 class="px-6 text-lg font-semibold text-focus-gray-900 md:px-7">Pour tous vos objectifs</h3>
            <p class="focus-body-sm mt-1 px-6 md:px-7">Habitudes quotidiennes, rythmes hebdomadaires, projets à jalons.</p>
            <div class="landing-marquee mt-6" aria-hidden="true">
              <div class="landing-marquee-track">
                <span
                  v-for="(item, index) in [...useCases, ...useCases]"
                  :key="index"
                  class="landing-chip"
                  :class="{ 'landing-chip-copy': index >= useCases.length }"
                >{{ item }}</span>
              </div>
            </div>
          </article>

          <!-- Binôme & défis -->
          <article class="landing-tile bento-tile md:col-span-2">
            <HugeiconsIcon :icon="UserMultiple02Icon" :size="22" :stroke-width="1.8" class="text-focus-gray-900" aria-hidden="true" />
            <h3 class="mt-4 text-lg font-semibold text-focus-gray-900">À plusieurs</h3>
            <p class="focus-body-sm mt-1">Un binôme qui voit votre journée, des défis d'une semaine entre amis.</p>
            <div class="mt-5 flex -space-x-2" aria-hidden="true">
              <span v-for="initial in ['C', 'S', 'L', 'M']" :key="initial" class="flex h-9 w-9 items-center justify-center rounded-full border-2 border-focus-white bg-focus-gray-100 text-xs font-semibold text-focus-gray-700">{{ initial }}</span>
            </div>
          </article>

          <!-- Pause -->
          <article class="landing-tile bento-tile md:col-span-2">
            <HugeiconsIcon :icon="PauseIcon" :size="22" :stroke-width="1.8" class="text-focus-gray-900" aria-hidden="true" />
            <h3 class="mt-4 text-lg font-semibold text-focus-gray-900">Pause et vacances</h3>
            <p class="focus-body-sm mt-1">Mettez tout en pause sans perdre votre série. Un délai de grâce si vous êtes un peu en retard.</p>
          </article>

          <!-- Open source -->
          <article class="landing-tile bento-tile bento-tile-dark md:col-span-2">
            <HugeiconsIcon :icon="GithubIcon" :size="22" :stroke-width="1.8" aria-hidden="true" />
            <h3 class="mt-4 text-lg font-semibold">Open source</h3>
            <p class="mt-1 text-sm leading-relaxed text-focus-gray-400">Code ouvert, auto-hébergeable. Vos données s'exportent en un clic.</p>
            <a href="https://github.com/mickaelrebeau/Focus" class="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-focus-white underline-offset-4 hover:underline" target="_blank" rel="noopener">
              Voir sur GitHub
              <HugeiconsIcon :icon="ArrowRight01Icon" :size="14" :stroke-width="2" aria-hidden="true" />
            </a>
          </article>

          <!-- Délai de grâce, heure limite -->
          <article class="landing-tile bento-tile md:col-span-2">
            <p class="text-4xl font-semibold tracking-tight text-focus-gray-900 tabular-nums">23:59</p>
            <p class="focus-body-sm mt-1">L'heure limite, c'est vous qui la fixez. Focus suggère le créneau où vous réussissez le mieux.</p>
          </article>
        </div>
      </div>
    </section>

    <!-- Comment ça marche -->
    <section class="bg-focus-gray-50 py-20 md:py-28">
      <div class="focus-container">
        <h2 class="landing-reveal focus-heading-lg text-center md:text-4xl">Trois temps, chaque jour</h2>
        <ol class="landing-steps relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          <div class="landing-steps-line absolute left-[10%] right-[10%] top-5 hidden h-px origin-left bg-focus-gray-300 md:block" aria-hidden="true" />
          <li v-for="(step, index) in steps" :key="step.title" class="landing-step relative text-center">
            <span class="relative mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-focus-gray-900 text-sm font-semibold text-focus-white">{{ index + 1 }}</span>
            <h3 class="mt-5 font-semibold text-focus-gray-900">{{ step.title }}</h3>
            <p class="focus-body-sm mx-auto mt-2 max-w-xs">{{ step.text }}</p>
          </li>
        </ol>
      </div>
    </section>

    <!-- Cagnottes : bento -->
    <section class="py-20 md:py-28">
      <div class="focus-container">
        <div class="mx-auto max-w-2xl text-center">
          <p class="landing-reveal focus-label">Transparence</p>
          <h2 class="landing-reveal focus-heading-lg mt-3 md:text-4xl">Vos échecs peuvent aider</h2>
          <p class="landing-reveal focus-body mt-4">
            Avec la conséquence « Don à une association », chaque échec alimente la cagnotte de l'association choisie. Tout est public, reversé chaque mois.
          </p>
        </div>

        <div class="landing-bento mt-12 grid gap-3 md:grid-cols-3 md:gap-4">
          <article class="landing-tile bento-tile md:col-span-2">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="focus-label">Cagnotte du mois</p>
                <p class="mt-2 text-4xl font-semibold tracking-tight text-focus-gray-900 tabular-nums">
                  <span class="landing-count" data-to="342">342</span> €
                </p>
              </div>
              <HugeiconsIcon :icon="FavouriteIcon" :size="22" :stroke-width="1.8" class="text-focus-gray-900" aria-hidden="true" />
            </div>
            <div class="mt-6 h-2 overflow-hidden rounded-full bg-focus-gray-100" aria-hidden="true">
              <div class="landing-progress h-full w-[68%] origin-left rounded-full bg-focus-gray-900" />
            </div>
            <p class="mt-2 text-xs text-focus-gray-400">Exemple illustratif · objectif mensuel 500 €</p>
          </article>
          <article class="landing-tile bento-tile">
            <HugeiconsIcon :icon="Analytics01Icon" :size="22" :stroke-width="1.8" class="text-focus-gray-900" aria-hidden="true" />
            <h3 class="mt-4 font-semibold text-focus-gray-900">Suivi public</h3>
            <p class="focus-body-sm mt-1">Montants collectés et reversements visibles par tous.</p>
          </article>
          <article class="landing-tile bento-tile md:col-span-3">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex items-center gap-3">
                <HugeiconsIcon :icon="CheckmarkBadge01Icon" :size="22" :stroke-width="1.8" class="shrink-0 text-focus-gray-900" aria-hidden="true" />
                <p class="text-sm text-focus-gray-700">Une cagnotte par association, reversée chaque mois avec un historique consultable.</p>
              </div>
              <NuxtLink to="/cagnottes" class="focus-btn-secondary shrink-0">Voir les cagnottes en direct</NuxtLink>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="pb-20 md:pb-28">
      <div class="focus-container">
        <div class="landing-cta relative overflow-hidden rounded-[32px] bg-focus-gray-900 px-6 py-16 text-center md:py-24">
          <div class="landing-grid landing-grid-dark pointer-events-none absolute inset-0" aria-hidden="true" />
          <h2 class="relative text-3xl font-semibold tracking-tight text-focus-white md:text-5xl">Prêt à vous engager ?</h2>
          <p class="relative mx-auto mt-4 max-w-md text-focus-gray-400">Gratuit, sans carte bancaire. Vos premiers crédits vous attendent.</p>
          <NuxtLink to="/inscription" class="relative mt-8 inline-flex items-center gap-2 rounded-full bg-focus-white px-7 py-3 text-sm font-medium text-focus-gray-900 transition hover:bg-focus-gray-100 active:scale-[0.98]">
            Créer mon compte
            <HugeiconsIcon :icon="ArrowRight01Icon" :size="16" :stroke-width="2" aria-hidden="true" />
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Grille de points très discrète, estompée vers les bords */
.landing-grid {
  background-image: radial-gradient(circle at 1px 1px, rgb(0 0 0 / 0.07) 1px, transparent 0);
  background-size: 28px 28px;
  mask-image: radial-gradient(ellipse 70% 60% at 50% 30%, #000 40%, transparent 100%);
}

.landing-grid-dark {
  background-image: radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.08) 1px, transparent 0);
  mask-image: radial-gradient(ellipse 60% 70% at 50% 50%, #000 30%, transparent 100%);
}

/* Mot du titre : masque pour la révélation par le bas */
.landing-word-mask {
  display: inline-block;
  overflow: hidden;
  padding-bottom: 0.08em;
  margin-bottom: -0.08em;
  vertical-align: bottom;
}

.landing-word-mask + .landing-word-mask {
  margin-left: 0.25em;
}

.landing-word {
  display: inline-block;
}

.bento-tile {
  @apply rounded-[24px] border border-focus-gray-200 bg-focus-white p-6 transition-colors duration-300 md:p-7;
}

.bento-tile:not(.bento-tile-dark):hover {
  @apply border-focus-gray-300;
}

.bento-tile-dark {
  @apply border-focus-gray-900 bg-focus-gray-900 text-focus-white;
}

.landing-chip {
  @apply shrink-0 rounded-full border border-focus-gray-200 bg-focus-white px-4 py-2 text-sm text-focus-gray-700;
}

/* Défilement continu des cas d'usage, en CSS : aucun coût JavaScript */
.landing-marquee {
  mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
}

.landing-marquee-track {
  display: flex;
  width: max-content;
  gap: 0.5rem;
  animation: landing-marquee 40s linear infinite;
}

.landing-marquee:hover .landing-marquee-track {
  animation-play-state: paused;
}

@keyframes landing-marquee {
  to { transform: translateX(-50%); }
}

@media (prefers-reduced-motion: reduce) {
  .landing-marquee-track {
    animation: none;
    flex-wrap: wrap;
    width: auto;
    padding: 0 1.5rem;
  }

  .landing-marquee {
    mask-image: none;
  }

  /* La seconde copie ne sert qu'à boucler le défilement */
  .landing-chip-copy {
    display: none;
  }
}
</style>
