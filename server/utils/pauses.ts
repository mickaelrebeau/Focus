import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { and, eq, gt, gte, isNull, lte } from 'drizzle-orm'
import { useDatabase, schema } from '../database'
import { getTodayInTimezone } from './occurrences'

/** Durée maximale d'une pause, en jours (bornes incluses). */
export const MAX_PAUSE_DAYS = 60

export type PauseStatus = 'upcoming' | 'active' | 'ended' | 'cancelled'
export type PauseRangeError = 'start_in_past' | 'end_before_start' | 'too_long'

export interface PauseRange {
  startDate: string
  endDate: string
}

type PauseRow = typeof schema.pausePeriods.$inferSelect

/**
 * Règles d'une nouvelle pause (dates locales `yyyy-MM-dd`, bornes incluses) :
 * - pas de pause rétroactive, pour ne pas effacer des échecs déjà constatés ;
 * - au plus MAX_PAUSE_DAYS jours.
 */
export function validatePauseRange(range: PauseRange, today: string): PauseRangeError | null {
  if (range.startDate < today) return 'start_in_past'
  if (range.endDate < range.startDate) return 'end_before_start'
  if (differenceInCalendarDays(parseISO(range.endDate), parseISO(range.startDate)) + 1 > MAX_PAUSE_DAYS) {
    return 'too_long'
  }
  return null
}

export function rangesOverlap(a: PauseRange, b: PauseRange) {
  return a.startDate <= b.endDate && b.startDate <= a.endDate
}

export function pauseStatus(pause: Pick<PauseRow, 'startDate' | 'endDate' | 'cancelledAt'>, today: string): PauseStatus {
  if (pause.cancelledAt) return 'cancelled'
  if (today < pause.startDate) return 'upcoming'
  if (today > pause.endDate) return 'ended'
  return 'active'
}

export function isDateInPauses(date: string, pauses: PauseRange[]) {
  return pauses.some(pause => date >= pause.startDate && date <= pause.endDate)
}

/** Toutes les dates couvertes par des pauses (jours « gelés » pour le streak). */
export function expandPauseDates(pauses: PauseRange[]) {
  const dates = new Set<string>()
  for (const pause of pauses) {
    let current = parseISO(pause.startDate)
    const end = parseISO(pause.endDate)
    while (current <= end) {
      dates.add(format(current, 'yyyy-MM-dd'))
      current = addDays(current, 1)
    }
  }
  return dates
}

/** Pauses effectives (non annulées) d'un utilisateur. */
export async function getEffectivePauses(userId: string): Promise<PauseRange[]> {
  const db = useDatabase()
  return db
    .select({ startDate: schema.pausePeriods.startDate, endDate: schema.pausePeriods.endDate })
    .from(schema.pausePeriods)
    .where(and(eq(schema.pausePeriods.userId, userId), isNull(schema.pausePeriods.cancelledAt)))
}

export async function getActivePause(userId: string, timezone: string) {
  const today = getTodayInTimezone(timezone)
  const db = useDatabase()
  const [pause] = await db
    .select()
    .from(schema.pausePeriods)
    .where(and(
      eq(schema.pausePeriods.userId, userId),
      isNull(schema.pausePeriods.cancelledAt),
      lte(schema.pausePeriods.startDate, today),
      gte(schema.pausePeriods.endDate, today),
    ))
    .limit(1)
  return pause ?? null
}

export class PauseError extends Error {
  constructor(public readonly code: PauseRangeError | 'overlap' | 'not_found' | 'already_ended') {
    super(code)
  }
}

/** Passe en « skipped » les échéances encore à faire de la période : aucune ne pourra échouer. */
async function skipPendingOccurrences(userId: string, range: PauseRange) {
  const db = useDatabase()
  const skipped = await db
    .update(schema.occurrences)
    .set({ status: 'skipped', processedAt: new Date() })
    .where(and(
      eq(schema.occurrences.userId, userId),
      eq(schema.occurrences.status, 'pending'),
      gte(schema.occurrences.dueDate, range.startDate),
      lte(schema.occurrences.dueDate, range.endDate),
    ))
    .returning({ id: schema.occurrences.id })
  return skipped.length
}

/** Remet « à faire » les échéances gelées dont l'heure limite n'est pas encore passée. */
async function restoreSkippedOccurrences(userId: string, range: PauseRange) {
  const db = useDatabase()
  const restored = await db
    .update(schema.occurrences)
    .set({ status: 'pending', processedAt: null })
    .where(and(
      eq(schema.occurrences.userId, userId),
      eq(schema.occurrences.status, 'skipped'),
      gte(schema.occurrences.dueDate, range.startDate),
      lte(schema.occurrences.dueDate, range.endDate),
      gt(schema.occurrences.dueAt, new Date()),
    ))
    .returning({ id: schema.occurrences.id })
  return restored.length
}

export async function createPause(
  user: { id: string, timezone: string },
  input: PauseRange & { reason?: string },
) {
  const today = getTodayInTimezone(user.timezone)
  const error = validatePauseRange(input, today)
  if (error) throw new PauseError(error)

  const existing = await getEffectivePauses(user.id)
  if (existing.some(pause => rangesOverlap(pause, input))) throw new PauseError('overlap')

  const db = useDatabase()
  const [pause] = await db
    .insert(schema.pausePeriods)
    .values({ userId: user.id, startDate: input.startDate, endDate: input.endDate, reason: input.reason })
    .returning()

  const skipped = await skipPendingOccurrences(user.id, input)
  return { pause: pause!, skipped }
}

/**
 * Annule une pause à venir, ou termine une pause en cours à la veille d'aujourd'hui.
 * Les échéances gelées encore à venir redeviennent « à faire ».
 */
export async function endPause(user: { id: string, timezone: string }, pauseId: string) {
  const db = useDatabase()
  const [pause] = await db
    .select()
    .from(schema.pausePeriods)
    .where(and(eq(schema.pausePeriods.id, pauseId), eq(schema.pausePeriods.userId, user.id)))
    .limit(1)
  if (!pause) throw new PauseError('not_found')

  const today = getTodayInTimezone(user.timezone)
  const status = pauseStatus(pause, today)
  if (status === 'ended' || status === 'cancelled') throw new PauseError('already_ended')

  const yesterday = format(addDays(parseISO(today), -1), 'yyyy-MM-dd')

  // Pas encore commencée, ou commencée aujourd'hui : aucun jour écoulé, annulation complète
  const cancelled = status === 'upcoming' || pause.startDate > yesterday
  if (cancelled) {
    await db.update(schema.pausePeriods).set({ cancelledAt: new Date() }).where(eq(schema.pausePeriods.id, pause.id))
  } else {
    await db
      .update(schema.pausePeriods)
      .set({ endDate: yesterday, originalEndDate: pause.endDate })
      .where(eq(schema.pausePeriods.id, pause.id))
  }

  const restored = await restoreSkippedOccurrences(user.id, {
    startDate: status === 'upcoming' ? pause.startDate : today,
    endDate: pause.endDate,
  })
  return { status: cancelled ? 'cancelled' as const : 'ended' as const, restored }
}

const MESSAGES: Record<PauseError['code'], string> = {
  start_in_past: 'Une pause ne peut pas commencer dans le passé',
  end_before_start: 'La date de fin doit suivre la date de début',
  too_long: `Une pause dure au maximum ${MAX_PAUSE_DAYS} jours`,
  overlap: 'Cette période chevauche une pause existante',
  not_found: 'Pause introuvable',
  already_ended: 'Cette pause est déjà terminée',
}

/** Erreurs métier des pauses → réponses HTTP (le code permet la traduction côté client). */
export function toPauseHttpError(error: unknown): never {
  if (error instanceof PauseError) {
    throw createError({
      statusCode: error.code === 'not_found' ? 404 : 400,
      message: MESSAGES[error.code],
      data: { code: error.code },
    })
  }
  throw error
}
