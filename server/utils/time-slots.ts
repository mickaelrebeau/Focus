import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'
import { DUE_TIME_SLOTS, DUE_TIME_SLOT_IDS, slotForTime, type DueTimeSlotId } from '../../shared/due-time-slots'
import { useDatabase, schema } from '../database'

/** Historique pris en compte pour les statistiques par créneau. */
export const SLOT_HISTORY_DAYS = 90
/** En dessous, un créneau n'est pas comparé (taux trop instable). */
export const MIN_SLOT_SAMPLES = 5

export interface SlotStat {
  slot: DueTimeSlotId
  completed: number
  failed: number
  total: number
  /** Taux de réussite en pourcentage entier, null sous MIN_SLOT_SAMPLES échéances. */
  rate: number | null
}

export interface SlotSuggestion {
  slot: DueTimeSlotId
  rate: number
  time: string
}

/**
 * Taux de réussite par créneau, à l'heure prévue initialement (avant un éventuel report),
 * dans le fuseau de l'utilisateur. Seules les échéances réussies ou échouées comptent.
 */
export function computeSlotStats(
  rows: Array<{ plannedAt: Date, status: string }>,
  timezone: string,
) {
  const stats = new Map<DueTimeSlotId, SlotStat & { times: Map<string, number> }>(
    DUE_TIME_SLOT_IDS.map(slot => [slot, { slot, completed: 0, failed: 0, total: 0, rate: null, times: new Map() }]),
  )

  for (const row of rows) {
    if (row.status !== 'completed' && row.status !== 'failed') continue
    const time = formatInTimeZone(row.plannedAt, timezone, 'HH:mm')
    const stat = stats.get(slotForTime(time))!
    stat.total++
    if (row.status === 'completed') {
      stat.completed++
      stat.times.set(time, (stat.times.get(time) ?? 0) + 1)
    } else {
      stat.failed++
    }
  }

  const slots = [...stats.values()].map(({ times, ...stat }) => ({
    ...stat,
    rate: stat.total >= MIN_SLOT_SAMPLES ? Math.round((stat.completed / stat.total) * 100) : null,
  }))

  // Une suggestion suppose de comparer : au moins deux créneaux avec assez de données
  const comparable = slots.filter(stat => stat.rate !== null)
  let suggestion: SlotSuggestion | null = null
  if (comparable.length >= 2) {
    const best = comparable.reduce((a, b) => (b.rate! > a.rate! || (b.rate === a.rate && b.total > a.total) ? b : a))
    // Heure proposée : celle qui a le plus souvent réussi dans ce créneau
    const times = stats.get(best.slot)!.times
    const time = [...times.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
    suggestion = { slot: best.slot, rate: best.rate!, time: time ?? DUE_TIME_SLOTS[best.slot].defaultTime }
  }

  return { slots, suggestion }
}

/** Statistiques de l'utilisateur, restreintes à la catégorie si elle a assez d'historique. */
export async function getSlotStatsForUser(user: { id: string, timezone: string }, category?: string, now = new Date()) {
  const since = new Date(now.getTime() - SLOT_HISTORY_DAYS * 24 * 60 * 60 * 1000)
  const rows = await useDatabase()
    .select({
      plannedAt: sql<Date>`coalesce(${schema.occurrences.originalDueAt}, ${schema.occurrences.dueAt})`.mapWith(value => new Date(value)),
      status: schema.occurrences.status,
      category: schema.goals.category,
    })
    .from(schema.occurrences)
    .innerJoin(schema.goals, eq(schema.goals.id, schema.occurrences.goalId))
    .where(and(
      eq(schema.occurrences.userId, user.id),
      inArray(schema.occurrences.status, ['completed', 'failed']),
      gte(schema.occurrences.dueAt, since),
    ))

  const wanted = category?.trim().toLowerCase()
  if (wanted) {
    const inCategory = rows.filter(row => row.category?.trim().toLowerCase() === wanted)
    const result = computeSlotStats(inCategory, user.timezone)
    if (result.suggestion) return { scope: 'category' as const, ...result }
  }
  return { scope: 'all' as const, ...computeSlotStats(rows, user.timezone) }
}
