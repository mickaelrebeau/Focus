// Créneaux de la journée et heures limites suggérées par catégorie (création d'objectif,
// statistiques de réussite par créneau). Partagé entre l'interface et l'API.

export const DUE_TIME_SLOT_IDS = ['morning', 'midday', 'afternoon', 'evening', 'night'] as const
export type DueTimeSlotId = typeof DUE_TIME_SLOT_IDS[number]

/** Heure de début de chaque créneau (heure locale) et heure limite proposée par défaut. */
export const DUE_TIME_SLOTS: Record<DueTimeSlotId, { fromHour: number, defaultTime: string }> = {
  morning: { fromHour: 5, defaultTime: '09:00' },
  midday: { fromHour: 11, defaultTime: '12:30' },
  afternoon: { fromHour: 14, defaultTime: '17:00' },
  evening: { fromHour: 18, defaultTime: '21:00' },
  night: { fromHour: 22, defaultTime: '23:59' },
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Créneau d'une heure « HH:MM ». La nuit va de 22:00 à 04:59. */
export function slotForTime(time: string): DueTimeSlotId {
  const match = TIME_PATTERN.exec(time)
  if (!match) throw new Error(`Heure invalide : ${time}`)
  return slotForHour(Number(match[1]))
}

export function slotForHour(hour: number): DueTimeSlotId {
  if (hour >= DUE_TIME_SLOTS.night.fromHour || hour < DUE_TIME_SLOTS.morning.fromHour) return 'night'
  if (hour >= DUE_TIME_SLOTS.evening.fromHour) return 'evening'
  if (hour >= DUE_TIME_SLOTS.afternoon.fromHour) return 'afternoon'
  if (hour >= DUE_TIME_SLOTS.midday.fromHour) return 'midday'
  return 'morning'
}

/**
 * Heures proposées selon la catégorie saisie (français ou anglais, sans tenir compte des
 * accents ni de la casse). Les catégories du catalogue de modèles sont toutes couvertes.
 */
export const CATEGORY_TIME_PRESETS: Array<{ keywords: string[], times: string[] }> = [
  { keywords: ['sport', 'course', 'courir', 'running', 'run', 'fitness', 'gym', 'muscu', 'workout'], times: ['07:00', '12:30', '18:30'] },
  { keywords: ['lecture', 'lire', 'livre', 'reading', 'read', 'book'], times: ['21:30', '22:30'] },
  { keywords: ['bien-etre', 'meditation', 'mediter', 'yoga', 'wellness', 'wellbeing', 'mindfulness'], times: ['07:30', '21:00'] },
  { keywords: ['travail', 'work', 'boulot', 'pro', 'focus'], times: ['10:00', '12:00', '17:30'] },
  { keywords: ['apprentissage', 'langue', 'etude', 'etudier', 'learning', 'language', 'study'], times: ['08:00', '19:00', '21:00'] },
  { keywords: ['ecriture', 'ecrire', 'writing', 'write', 'journal'], times: ['08:00', '22:00'] },
  { keywords: ['reseaux sociaux', 'social', 'linkedin', 'instagram', 'twitter', 'contenu', 'content'], times: ['09:00', '12:00', '18:00'] },
  { keywords: ['sante', 'health', 'sommeil', 'sleep', 'ecran', 'screen'], times: ['07:00', '22:00'] },
]

export function normalizeCategory(category: string) {
  return category.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Heures suggérées pour une catégorie, sans doublon ; vide si la catégorie n'est pas reconnue. */
export function presetsForCategory(category: string | null | undefined): string[] {
  if (!category) return []
  const words = normalizeCategory(category).split(/[^a-z-]+/).filter(Boolean)
  const normalized = normalizeCategory(category)
  const times = CATEGORY_TIME_PRESETS
    .filter(preset => preset.keywords.some(keyword => keyword.includes(' ') ? normalized.includes(keyword) : words.includes(keyword)))
    .flatMap(preset => preset.times)
  return [...new Set(times)].sort()
}
