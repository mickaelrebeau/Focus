import { createHash, randomBytes } from 'node:crypto'
import { addDays, format, parseISO } from 'date-fns'
import { and, eq, gte, inArray, lt, or } from 'drizzle-orm'
import { useDatabase, schema } from '../database'
import { getTodayInTimezone } from './occurrences'
import { expandPauseDates, getEffectivePauses } from './pauses'

export const INVITE_TTL_DAYS = 7
export const PARTNER_HISTORY_DAYS = 7

export type PartnerDayStatus = 'success' | 'failed' | 'late' | 'in_progress' | 'rest' | 'paused'
export type PartnerHistoryStatus = 'success' | 'failed' | 'neutral' | 'paused'

export type PartnershipErrorCode =
  | 'invalid_invite'
  | 'expired'
  | 'self'
  | 'already_partnered'
  | 'inviter_partnered'
  | 'not_found'

export class PartnershipError extends Error {
  constructor(public readonly code: PartnershipErrorCode) {
    super(code)
  }
}

export function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function generateInviteToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashInviteToken(token) }
}

/**
 * Statut du jour vu par le binôme : uniquement des compteurs, jamais les titres,
 * notes, preuves, crédits ou conséquences.
 */
export function summarizePartnerDay(
  occurrences: Array<{ status: string, dueAt: Date }>,
  options: { paused: boolean, now?: Date },
): { status: PartnerDayStatus, total: number, completed: number } {
  const now = options.now ?? new Date()
  const relevant = occurrences.filter(occurrence => occurrence.status !== 'skipped')
  const total = relevant.length
  const completed = relevant.filter(occurrence => occurrence.status === 'completed').length

  let status: PartnerDayStatus
  if (options.paused && total === 0) status = 'paused'
  else if (total === 0) status = 'rest'
  else if (relevant.some(occurrence => occurrence.status === 'failed')) status = 'failed'
  else if (relevant.some(occurrence => occurrence.status === 'pending' && occurrence.dueAt < now)) status = 'late'
  else if (completed === total) status = 'success'
  else status = 'in_progress'

  return { status, total, completed }
}

/** Les N jours précédant `today`, du plus ancien au plus récent. */
export function buildPartnerHistory(
  today: string,
  dailyResults: Array<{ dateKey: string, status: string }>,
  pausedDates: ReadonlySet<string>,
  days = PARTNER_HISTORY_DAYS,
): Array<{ date: string, status: PartnerHistoryStatus }> {
  const byDate = new Map(dailyResults.map(result => [result.dateKey, result.status]))
  return Array.from({ length: days }, (_, index) => {
    const date = format(addDays(parseISO(today), index - days), 'yyyy-MM-dd')
    const result = byDate.get(date)
    const status: PartnerHistoryStatus = result === 'success' || result === 'failed'
      ? result
      : pausedDates.has(date) ? 'paused' : 'neutral'
    return { date, status }
  })
}

type PartnershipRow = typeof schema.partnerships.$inferSelect

export async function getActivePartnership(userId: string): Promise<PartnershipRow | null> {
  const [row] = await useDatabase()
    .select()
    .from(schema.partnerships)
    .where(and(
      eq(schema.partnerships.status, 'active'),
      or(eq(schema.partnerships.inviterId, userId), eq(schema.partnerships.partnerId, userId)),
    ))
    .limit(1)
  return row ?? null
}

export async function getPendingInvitation(userId: string): Promise<PartnershipRow | null> {
  const [row] = await useDatabase()
    .select()
    .from(schema.partnerships)
    .where(and(
      eq(schema.partnerships.status, 'pending'),
      eq(schema.partnerships.inviterId, userId),
      gte(schema.partnerships.expiresAt, new Date()),
    ))
    .limit(1)
  return row ?? null
}

/** Crée une invitation (et invalide la précédente). Le jeton n'est renvoyé qu'ici. */
export async function createInvitation(userId: string) {
  if (await getActivePartnership(userId)) throw new PartnershipError('already_partnered')

  const db = useDatabase()
  await db
    .update(schema.partnerships)
    .set({ status: 'revoked', revokedAt: new Date(), revokedBy: userId })
    .where(and(eq(schema.partnerships.inviterId, userId), eq(schema.partnerships.status, 'pending')))

  const { token, hash } = generateInviteToken()
  const expiresAt = addDays(new Date(), INVITE_TTL_DAYS)
  await db.insert(schema.partnerships).values({ inviterId: userId, inviteTokenHash: hash, expiresAt })
  return { token, expiresAt }
}

/** Informations publiques d'une invitation : le prénom de l'invitant, rien d'autre. */
export async function getInvitation(token: string) {
  const [row] = await useDatabase()
    .select({
      status: schema.partnerships.status,
      expiresAt: schema.partnerships.expiresAt,
      inviterId: schema.partnerships.inviterId,
      inviterName: schema.users.displayName,
    })
    .from(schema.partnerships)
    .innerJoin(schema.users, eq(schema.users.id, schema.partnerships.inviterId))
    .where(eq(schema.partnerships.inviteTokenHash, hashInviteToken(token)))
    .limit(1)

  if (!row || row.status !== 'pending') throw new PartnershipError('invalid_invite')
  if (row.expiresAt < new Date()) throw new PartnershipError('expired')
  return row
}

export async function acceptInvitation(userId: string, token: string) {
  const db = useDatabase()
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(schema.partnerships)
      .where(eq(schema.partnerships.inviteTokenHash, hashInviteToken(token)))
      .for('update')

    if (!row || row.status !== 'pending') throw new PartnershipError('invalid_invite')
    if (row.expiresAt < new Date()) throw new PartnershipError('expired')
    if (row.inviterId === userId) throw new PartnershipError('self')

    const existing = await tx
      .select({ inviterId: schema.partnerships.inviterId, partnerId: schema.partnerships.partnerId })
      .from(schema.partnerships)
      .where(and(
        eq(schema.partnerships.status, 'active'),
        or(
          inArray(schema.partnerships.inviterId, [userId, row.inviterId]),
          inArray(schema.partnerships.partnerId, [userId, row.inviterId]),
        ),
      ))
    if (existing.some(item => item.inviterId === userId || item.partnerId === userId)) {
      throw new PartnershipError('already_partnered')
    }
    if (existing.length) throw new PartnershipError('inviter_partnered')

    const [partnership] = await tx
      .update(schema.partnerships)
      .set({ partnerId: userId, status: 'active', acceptedAt: new Date() })
      .where(eq(schema.partnerships.id, row.id))
      .returning()

    // L'acceptant ne garde pas d'invitation en attente de son côté
    await tx
      .update(schema.partnerships)
      .set({ status: 'revoked', revokedAt: new Date(), revokedBy: userId })
      .where(and(eq(schema.partnerships.inviterId, userId), eq(schema.partnerships.status, 'pending')))

    return partnership!
  })
}

/** Révocation par l'un ou l'autre membre, à tout moment (ou annulation d'une invitation). */
export async function revokePartnership(userId: string, partnershipId: string) {
  const [row] = await useDatabase()
    .update(schema.partnerships)
    .set({ status: 'revoked', revokedAt: new Date(), revokedBy: userId })
    .where(and(
      eq(schema.partnerships.id, partnershipId),
      inArray(schema.partnerships.status, ['pending', 'active']),
      or(eq(schema.partnerships.inviterId, userId), eq(schema.partnerships.partnerId, userId)),
    ))
    .returning({ id: schema.partnerships.id })
  if (!row) throw new PartnershipError('not_found')
}

/** Vue binôme : strictement le statut, jamais le contenu des objectifs ni l'argent. */
export async function getPartnerView(userId: string) {
  const partnership = await getActivePartnership(userId)
  if (!partnership) return null

  const partnerId = partnership.inviterId === userId ? partnership.partnerId! : partnership.inviterId
  const db = useDatabase()
  const [partner] = await db
    .select({ displayName: schema.users.displayName, timezone: schema.users.timezone })
    .from(schema.users)
    .where(eq(schema.users.id, partnerId))
    .limit(1)
  if (!partner) return null

  const today = getTodayInTimezone(partner.timezone)
  const historyStart = format(addDays(parseISO(today), -PARTNER_HISTORY_DAYS), 'yyyy-MM-dd')

  const [todayOccurrences, dailyResults, pauses, streakRows] = await Promise.all([
    db
      .select({ status: schema.occurrences.status, dueAt: schema.occurrences.dueAt })
      .from(schema.occurrences)
      .where(and(eq(schema.occurrences.userId, partnerId), eq(schema.occurrences.dueDate, today))),
    db
      .select({ dateKey: schema.userDailyResults.dateKey, status: schema.userDailyResults.status })
      .from(schema.userDailyResults)
      .where(and(
        eq(schema.userDailyResults.userId, partnerId),
        gte(schema.userDailyResults.dateKey, historyStart),
        lt(schema.userDailyResults.dateKey, today),
      )),
    getEffectivePauses(partnerId),
    db
      .select({ currentStreak: schema.userStreaks.currentStreak })
      .from(schema.userStreaks)
      .where(eq(schema.userStreaks.userId, partnerId))
      .limit(1),
  ])

  const pausedDates = expandPauseDates(pauses)
  return {
    partnershipId: partnership.id,
    since: partnership.acceptedAt,
    partner: { displayName: partner.displayName },
    today: { date: today, ...summarizePartnerDay(todayOccurrences, { paused: pausedDates.has(today) }) },
    streak: streakRows[0]?.currentStreak ?? 0,
    history: buildPartnerHistory(today, dailyResults, pausedDates),
  }
}

const ERROR_RESPONSES: Record<PartnershipErrorCode, { statusCode: number, message: string }> = {
  invalid_invite: { statusCode: 404, message: 'Invitation invalide ou déjà utilisée' },
  expired: { statusCode: 410, message: 'Cette invitation a expiré' },
  self: { statusCode: 400, message: 'Vous ne pouvez pas accepter votre propre invitation' },
  already_partnered: { statusCode: 409, message: 'Vous avez déjà un binôme' },
  inviter_partnered: { statusCode: 409, message: 'Cette personne a déjà un binôme' },
  not_found: { statusCode: 404, message: 'Binôme introuvable' },
}

/** Erreurs métier → réponses HTTP ; `data.code` permet la traduction côté client. */
export function toPartnershipHttpError(error: unknown): never {
  if (error instanceof PartnershipError) {
    throw createError({ ...ERROR_RESPONSES[error.code], data: { code: error.code } })
  }
  throw error
}
