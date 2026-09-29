import { and, eq } from 'drizzle-orm'
import { useDatabase, schema } from '../database'
import { logAudit } from './audit'
import { isExpired } from './grace'
import { getTodayInTimezone } from './occurrences'
import { weekRange } from './weekly-review'

/** Reports autorisés par semaine ISO (garanti par une contrainte d'unicité, voir 0018). */
export const POSTPONES_PER_WEEK = 1
export const POSTPONE_HOURS = 24

export type PostponeErrorCode = 'not_found' | 'not_pending' | 'expired' | 'already_postponed' | 'quota_reached'

export class PostponeError extends Error {
  constructor(public code: PostponeErrorCode) {
    super(code)
  }
}

const ERROR_RESPONSES: Record<PostponeErrorCode, { statusCode: number, message: string }> = {
  not_found: { statusCode: 404, message: 'Échéance introuvable' },
  not_pending: { statusCode: 409, message: 'Seule une échéance à faire peut être reportée' },
  expired: { statusCode: 409, message: 'Échéance déjà expirée : elle ne peut plus être reportée' },
  already_postponed: { statusCode: 409, message: 'Cette échéance a déjà été reportée' },
  quota_reached: { statusCode: 409, message: 'Vous avez déjà utilisé votre report de la semaine' },
}

export function toPostponeHttpError(error: unknown): never {
  if (error instanceof PostponeError) {
    throw createError({ ...ERROR_RESPONSES[error.code], data: { code: error.code } })
  }
  throw error
}

/** Lundi de la semaine en cours dans le fuseau de l'utilisateur : clé du quota. */
export function postponeWeekStart(timezone: string, now = new Date()) {
  return weekRange(getTodayInTimezone(timezone, now)).start
}

/**
 * Règles d'un report, vérifiées avant toute écriture. Tant que l'échéance n'a pas expiré,
 * aucune conséquence n'a pu partir : reporter ne peut ni annuler ni doubler une sanction.
 */
export function checkPostponable(
  occurrence: { status: string, dueAt: Date, originalDueAt: Date | null },
  graceMinutes: number,
  now = new Date(),
): PostponeErrorCode | null {
  if (occurrence.status !== 'pending') return 'not_pending'
  if (occurrence.originalDueAt) return 'already_postponed'
  if (isExpired(occurrence.dueAt, graceMinutes, now)) return 'expired'
  return null
}

export async function getPostponeQuota(user: { id: string, timezone: string }, now = new Date()) {
  const weekStart = postponeWeekStart(user.timezone, now)
  const [used] = await useDatabase()
    .select({ id: schema.occurrencePostponements.id })
    .from(schema.occurrencePostponements)
    .where(and(
      eq(schema.occurrencePostponements.userId, user.id),
      eq(schema.occurrencePostponements.weekStart, weekStart),
    ))
    .limit(1)
  return { weekStart, remaining: used ? 0 : POSTPONES_PER_WEEK }
}

/**
 * Reporte l'heure limite de 24 h. La date de l'échéance (due_date) ne change pas : la journée
 * reste la même pour le streak, les défis et le bilan, et reste ouverte jusqu'à la nouvelle heure.
 */
export async function postponeOccurrence(
  user: { id: string, timezone: string, graceMinutes: number },
  occurrenceId: string,
  now = new Date(),
) {
  const weekStart = postponeWeekStart(user.timezone, now)

  const result = await useDatabase().transaction(async (tx) => {
    const [occurrence] = await tx
      .select()
      .from(schema.occurrences)
      .where(and(eq(schema.occurrences.id, occurrenceId), eq(schema.occurrences.userId, user.id)))
      .for('update')
    if (!occurrence) throw new PostponeError('not_found')

    const refusal = checkPostponable(occurrence, user.graceMinutes, now)
    if (refusal) throw new PostponeError(refusal)

    const newDueAt = new Date(occurrence.dueAt.getTime() + POSTPONE_HOURS * 60 * 60 * 1000)
    const [recorded] = await tx
      .insert(schema.occurrencePostponements)
      .values({
        occurrenceId,
        userId: user.id,
        weekStart,
        originalDueAt: occurrence.dueAt,
        newDueAt,
      })
      .onConflictDoNothing({ target: [schema.occurrencePostponements.userId, schema.occurrencePostponements.weekStart] })
      .returning({ id: schema.occurrencePostponements.id })
    if (!recorded) throw new PostponeError('quota_reached')

    await tx
      .update(schema.occurrences)
      .set({ dueAt: newDueAt, originalDueAt: occurrence.dueAt })
      .where(eq(schema.occurrences.id, occurrenceId))

    return { goalId: occurrence.goalId, dueDate: occurrence.dueDate, originalDueAt: occurrence.dueAt, newDueAt }
  })

  await logAudit(user.id, 'occurrence.postpone', 'occurrence', occurrenceId, {
    goalId: result.goalId,
    dueDate: result.dueDate,
    originalDueAt: result.originalDueAt.toISOString(),
    newDueAt: result.newDueAt.toISOString(),
    weekStart,
  })

  return { dueAt: result.newDueAt, originalDueAt: result.originalDueAt }
}
