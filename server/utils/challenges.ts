import { createHash, randomBytes } from 'node:crypto'
import { addDays, format, parseISO } from 'date-fns'
import { and, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm'
import { useDatabase, schema } from '../database'
import { applyCreditOperation } from './credits'
import { createNotification } from './notifications'
import { getTodayInTimezone } from './occurrences'
import { notifySafely, pushMessages } from './push'
import { weekRange } from './weekly-review'

export const CHALLENGE_METRICS = ['perfect_days', 'completed_occurrences'] as const
export const CHALLENGE_STAKES = [0, 10, 20, 50] as const
export const MIN_PARTICIPANTS = 2
export const MAX_PARTICIPANTS = 8

export type ChallengeMetric = typeof CHALLENGE_METRICS[number]
export type ChallengeStatus = 'upcoming' | 'running' | 'finishing' | 'closed' | 'cancelled'

export type ChallengeErrorCode =
  | 'invalid_invite'
  | 'full'
  | 'already_joined'
  | 'ended'
  | 'insufficient_credits'
  | 'not_participant'
  | 'closed'

export class ChallengeError extends Error {
  constructor(public readonly code: ChallengeErrorCode) {
    super(code)
  }
}

type ChallengeRow = typeof schema.challenges.$inferSelect

export function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function newInviteToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashInviteToken(token) }
}

/**
 * Instant de clôture : le lundi suivant à 12:00 UTC. Le dimanche est alors terminé dans
 * tous les fuseaux (jusqu'à UTC−12), et le tick du worker a clôturé les journées.
 */
export function closeInstant(weekEnd: string) {
  return new Date(`${format(addDays(parseISO(weekEnd), 1), 'yyyy-MM-dd')}T12:00:00Z`)
}

export function challengeStatus(challenge: Pick<ChallengeRow, 'weekStart' | 'weekEnd' | 'closedAt' | 'outcome'>, today: string): ChallengeStatus {
  if (challenge.outcome === 'cancelled') return 'cancelled'
  if (challenge.closedAt) return 'closed'
  if (today < challenge.weekStart) return 'upcoming'
  if (today <= challenge.weekEnd) return 'running'
  return 'finishing'
}

/** Classement « olympique » : ex æquo au même rang, le suivant saute (1, 1, 3). */
export function rankParticipants<T extends { score: number }>(participants: T[]): Array<T & { rank: number }> {
  const sorted = [...participants].sort((a, b) => b.score - a.score)
  return sorted.map((participant, index) => ({
    ...participant,
    rank: index > 0 && sorted[index - 1]!.score === participant.score
      ? sorted.findIndex(other => other.score === participant.score) + 1
      : index + 1,
  }))
}

/**
 * Répartition de la cagnotte entre les premiers (rang 1, ex æquo inclus). Le reste de la
 * division va au premier inscrit parmi eux, pour ne perdre aucun crédit.
 */
export function splitPot(pot: number, winners: Array<{ userId: string, joinedAt: Date }>) {
  const payouts = new Map<string, number>()
  if (pot <= 0 || winners.length === 0) return payouts
  const share = Math.floor(pot / winners.length)
  const byJoin = [...winners].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
  byJoin.forEach((winner, index) => payouts.set(winner.userId, share + (index === 0 ? pot - share * winners.length : 0)))
  return payouts
}

/** Scores des participants sur la semaine, selon la mesure du défi. */
export async function computeScores(challenge: Pick<ChallengeRow, 'metric' | 'weekStart' | 'weekEnd'>, userIds: string[]) {
  const scores = new Map(userIds.map(id => [id, 0]))
  if (userIds.length === 0) return scores
  const db = useDatabase()

  const rows = challenge.metric === 'perfect_days'
    ? await db
        .select({ userId: schema.userDailyResults.userId, score: sql<number>`count(*)::int` })
        .from(schema.userDailyResults)
        .where(and(
          inArray(schema.userDailyResults.userId, userIds),
          eq(schema.userDailyResults.status, 'success'),
          gte(schema.userDailyResults.dateKey, challenge.weekStart),
          lte(schema.userDailyResults.dateKey, challenge.weekEnd),
        ))
        .groupBy(schema.userDailyResults.userId)
    : await db
        .select({ userId: schema.occurrences.userId, score: sql<number>`count(*)::int` })
        .from(schema.occurrences)
        .where(and(
          inArray(schema.occurrences.userId, userIds),
          eq(schema.occurrences.status, 'completed'),
          gte(schema.occurrences.dueDate, challenge.weekStart),
          lte(schema.occurrences.dueDate, challenge.weekEnd),
        ))
        .groupBy(schema.occurrences.userId)

  for (const row of rows) scores.set(row.userId, row.score)
  return scores
}

type Tx = Parameters<Parameters<ReturnType<typeof useDatabase>['transaction']>[0]>[0]

/** Inscription (ou réinscription) avec prélèvement de la mise, sans jamais créer de dette. */
async function addParticipant(tx: Tx, challenge: ChallengeRow, userId: string) {
  const [existing] = await tx
    .select()
    .from(schema.challengeParticipants)
    .where(and(eq(schema.challengeParticipants.challengeId, challenge.id), eq(schema.challengeParticipants.userId, userId)))
    .for('update')
  if (existing && !existing.leftAt) throw new ChallengeError('already_joined')

  const [counted] = await tx
    .select({ active: sql<number>`count(*)::int` })
    .from(schema.challengeParticipants)
    .where(and(eq(schema.challengeParticipants.challengeId, challenge.id), isNull(schema.challengeParticipants.leftAt)))
  if ((counted?.active ?? 0) >= challenge.maxParticipants) throw new ChallengeError('full')

  if (challenge.stakeCredits > 0) {
    const [wallet] = await tx.select().from(schema.wallets).where(eq(schema.wallets.userId, userId)).for('update')
    if (!wallet || wallet.balance < challenge.stakeCredits) throw new ChallengeError('insufficient_credits')
    await applyCreditOperation({
      userId,
      type: 'challenge_stake',
      amount: -challenge.stakeCredits,
      reason: `Mise du défi « ${challenge.name} »`,
      metadata: { challengeId: challenge.id },
    }, tx)
  }

  if (existing) {
    await tx
      .update(schema.challengeParticipants)
      .set({ leftAt: null, joinedAt: new Date(), stakePaid: existing.stakePaid + challenge.stakeCredits })
      .where(eq(schema.challengeParticipants.id, existing.id))
  } else {
    await tx.insert(schema.challengeParticipants).values({ challengeId: challenge.id, userId, stakePaid: challenge.stakeCredits })
  }
}

export async function createChallenge(
  user: { id: string, timezone: string },
  input: { name: string, week: 'current' | 'next', metric: ChallengeMetric, stakeCredits: number },
) {
  const today = getTodayInTimezone(user.timezone)
  const base = weekRange(today)
  const week = input.week === 'next' ? weekRange(format(addDays(parseISO(base.start), 7), 'yyyy-MM-dd')) : base
  const { token, hash } = newInviteToken()

  const challenge = await useDatabase().transaction(async (tx) => {
    const [created] = await tx.insert(schema.challenges).values({
      creatorId: user.id,
      name: input.name,
      metric: input.metric,
      weekStart: week.start,
      weekEnd: week.end,
      stakeCredits: input.stakeCredits,
      maxParticipants: MAX_PARTICIPANTS,
      inviteTokenHash: hash,
    }).returning()
    await addParticipant(tx, created!, user.id)
    return created!
  })

  return { challenge, token }
}

async function findByToken(token: string) {
  const [challenge] = await useDatabase()
    .select()
    .from(schema.challenges)
    .where(eq(schema.challenges.inviteTokenHash, hashInviteToken(token)))
    .limit(1)
  if (!challenge) throw new ChallengeError('invalid_invite')
  return challenge
}

/** Informations publiques d'une invitation (avant connexion). */
export async function getInvitation(token: string) {
  const challenge = await findByToken(token)
  const db = useDatabase()
  // Créateur purgé (compte supprimé) : le défi reste, sans nom d'organisateur
  const [creator] = challenge.creatorId
    ? await db.select({ displayName: schema.users.displayName }).from(schema.users).where(eq(schema.users.id, challenge.creatorId)).limit(1)
    : []
  const [counted] = await db
    .select({ participants: sql<number>`count(*)::int` })
    .from(schema.challengeParticipants)
    .where(and(eq(schema.challengeParticipants.challengeId, challenge.id), isNull(schema.challengeParticipants.leftAt)))
  return {
    id: challenge.id,
    name: challenge.name,
    creatorName: creator?.displayName ?? '',
    metric: challenge.metric,
    weekStart: challenge.weekStart,
    weekEnd: challenge.weekEnd,
    stakeCredits: challenge.stakeCredits,
    participants: counted?.participants ?? 0,
    maxParticipants: challenge.maxParticipants,
    closed: Boolean(challenge.closedAt),
  }
}

export async function joinChallenge(user: { id: string, timezone: string }, token: string) {
  const challenge = await findByToken(token)
  if (challenge.closedAt) throw new ChallengeError('closed')
  if (getTodayInTimezone(user.timezone) > challenge.weekEnd) throw new ChallengeError('ended')
  await useDatabase().transaction(tx => addParticipant(tx, challenge, user.id))
  return challenge
}

/**
 * Quitter un défi : avant son début, la mise est remboursée ; ensuite, elle reste dans la
 * cagnotte (engagement pris).
 */
export async function leaveChallenge(user: { id: string, timezone: string }, challengeId: string) {
  return useDatabase().transaction(async (tx) => {
    const [challenge] = await tx.select().from(schema.challenges).where(eq(schema.challenges.id, challengeId)).for('update')
    if (!challenge) throw new ChallengeError('not_participant')
    if (challenge.closedAt) throw new ChallengeError('closed')

    const [participant] = await tx
      .select()
      .from(schema.challengeParticipants)
      .where(and(
        eq(schema.challengeParticipants.challengeId, challengeId),
        eq(schema.challengeParticipants.userId, user.id),
        isNull(schema.challengeParticipants.leftAt),
      ))
      .for('update')
    if (!participant) throw new ChallengeError('not_participant')

    const beforeStart = getTodayInTimezone(user.timezone) < challenge.weekStart
    const refund = beforeStart ? participant.stakePaid : 0
    await tx
      .update(schema.challengeParticipants)
      .set({ leftAt: new Date(), stakePaid: participant.stakePaid - refund })
      .where(eq(schema.challengeParticipants.id, participant.id))

    if (refund > 0) {
      await applyCreditOperation({
        userId: user.id,
        type: 'challenge_refund',
        amount: refund,
        reason: `Remboursement du défi « ${challenge.name} »`,
        metadata: { challengeId },
      }, tx)
    }
    return { refunded: refund }
  })
}

export async function regenerateInvite(userId: string, challengeId: string) {
  await assertParticipant(userId, challengeId)
  const { token, hash } = newInviteToken()
  await useDatabase().update(schema.challenges).set({ inviteTokenHash: hash }).where(eq(schema.challenges.id, challengeId))
  return { token }
}

async function assertParticipant(userId: string, challengeId: string) {
  const [row] = await useDatabase()
    .select({ id: schema.challengeParticipants.id })
    .from(schema.challengeParticipants)
    .where(and(eq(schema.challengeParticipants.challengeId, challengeId), eq(schema.challengeParticipants.userId, userId)))
    .limit(1)
  if (!row) throw new ChallengeError('not_participant')
}

/** Détail d'un défi pour un participant : podium en temps réel, ou figé après clôture. */
export async function getChallengeDetail(user: { id: string, timezone: string }, challengeId: string) {
  await assertParticipant(user.id, challengeId)
  const db = useDatabase()
  const [challenge] = await db.select().from(schema.challenges).where(eq(schema.challenges.id, challengeId)).limit(1)
  if (!challenge) throw new ChallengeError('not_participant')

  const participants = await db
    .select({
      userId: schema.challengeParticipants.userId,
      displayName: schema.users.displayName,
      joinedAt: schema.challengeParticipants.joinedAt,
      leftAt: schema.challengeParticipants.leftAt,
      stakePaid: schema.challengeParticipants.stakePaid,
      finalScore: schema.challengeParticipants.finalScore,
      finalRank: schema.challengeParticipants.finalRank,
      payout: schema.challengeParticipants.payout,
    })
    .from(schema.challengeParticipants)
    .innerJoin(schema.users, eq(schema.users.id, schema.challengeParticipants.userId))
    .where(eq(schema.challengeParticipants.challengeId, challengeId))

  const active = participants.filter(p => !p.leftAt)
  const live = challenge.closedAt ? null : await computeScores(challenge, active.map(p => p.userId))
  const ranking = challenge.closedAt
    ? active
        .map(p => ({ ...p, score: p.finalScore ?? 0, rank: p.finalRank ?? 0 }))
        .sort((a, b) => a.rank - b.rank)
    : rankParticipants(active.map(p => ({ ...p, score: live!.get(p.userId) ?? 0 })))

  return {
    id: challenge.id,
    name: challenge.name,
    metric: challenge.metric,
    weekStart: challenge.weekStart,
    weekEnd: challenge.weekEnd,
    stakeCredits: challenge.stakeCredits,
    pot: participants.reduce((sum, p) => sum + p.stakePaid, 0),
    maxParticipants: challenge.maxParticipants,
    status: challengeStatus(challenge, getTodayInTimezone(user.timezone)),
    isCreator: challenge.creatorId === user.id,
    // Uniquement prénoms, scores et gains : aucune donnée privée des autres participants
    ranking: ranking.map(p => ({
      displayName: p.displayName,
      score: p.score,
      rank: p.rank,
      payout: p.payout,
      isMe: p.userId === user.id,
    })),
  }
}

export async function listMyChallenges(user: { id: string, timezone: string }) {
  const today = getTodayInTimezone(user.timezone)
  const rows = await useDatabase()
    .select({
      challenge: schema.challenges,
      participants: sql<number>`(SELECT count(*)::int FROM ${schema.challengeParticipants} p WHERE p.challenge_id = ${schema.challenges.id} AND p.left_at IS NULL)`,
    })
    .from(schema.challengeParticipants)
    .innerJoin(schema.challenges, eq(schema.challenges.id, schema.challengeParticipants.challengeId))
    .where(and(eq(schema.challengeParticipants.userId, user.id), isNull(schema.challengeParticipants.leftAt)))

  return rows
    .map(({ challenge, participants }) => ({
      id: challenge.id,
      name: challenge.name,
      metric: challenge.metric,
      weekStart: challenge.weekStart,
      weekEnd: challenge.weekEnd,
      stakeCredits: challenge.stakeCredits,
      participants,
      status: challengeStatus(challenge, today),
    }))
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
}

/**
 * Clôture des défis terminés (worker deadlines). Idempotente : chaque défi est verrouillé
 * et n'est soldé qu'une fois (closed_at). Moins de 2 participants : mises remboursées.
 */
export async function closeFinishedChallenges(now = new Date()) {
  const db = useDatabase()
  const candidates = await db
    .select({ id: schema.challenges.id, weekEnd: schema.challenges.weekEnd })
    .from(schema.challenges)
    .where(isNull(schema.challenges.closedAt))

  const due = candidates.filter(c => closeInstant(c.weekEnd) <= now)
  let closed = 0

  for (const { id } of due) {
    const result = await db.transaction(async (tx) => {
      const [challenge] = await tx.select().from(schema.challenges).where(eq(schema.challenges.id, id)).for('update')
      if (!challenge || challenge.closedAt) return null

      const participants = await tx
        .select()
        .from(schema.challengeParticipants)
        .where(eq(schema.challengeParticipants.challengeId, id))
      const active = participants.filter(p => !p.leftAt)
      const pot = participants.reduce((sum, p) => sum + p.stakePaid, 0)

      if (active.length < MIN_PARTICIPANTS) {
        for (const participant of participants.filter(p => p.stakePaid > 0)) {
          await applyCreditOperation({
            userId: participant.userId,
            type: 'challenge_refund',
            amount: participant.stakePaid,
            reason: `Défi « ${challenge.name} » annulé (moins de ${MIN_PARTICIPANTS} participants)`,
            metadata: { challengeId: id },
          }, tx)
        }
        await tx.update(schema.challenges).set({ closedAt: now, outcome: 'cancelled' }).where(eq(schema.challenges.id, id))
        return { challenge, notify: active.map(p => ({ userId: p.userId, rank: null, payout: 0 })) }
      }

      const scores = await computeScores(challenge, active.map(p => p.userId))
      const ranked = rankParticipants(active.map(p => ({ ...p, score: scores.get(p.userId) ?? 0 })))
      const payouts = splitPot(pot, ranked.filter(p => p.rank === 1))

      for (const participant of ranked) {
        const payout = payouts.get(participant.userId) ?? 0
        await tx
          .update(schema.challengeParticipants)
          .set({ finalScore: participant.score, finalRank: participant.rank, payout })
          .where(eq(schema.challengeParticipants.id, participant.id))
        if (payout > 0) {
          await applyCreditOperation({
            userId: participant.userId,
            type: 'challenge_payout',
            amount: payout,
            reason: `Gain du défi « ${challenge.name} »`,
            metadata: { challengeId: id, rank: participant.rank },
          }, tx)
        }
      }
      await tx.update(schema.challenges).set({ closedAt: now, outcome: 'completed' }).where(eq(schema.challenges.id, id))
      return { challenge, notify: ranked.map(p => ({ userId: p.userId, rank: p.rank, payout: payouts.get(p.userId) ?? 0 })) }
    })

    if (!result) continue
    closed++
    // Notification de fin, après validation de la transaction
    for (const { userId, rank, payout } of result.notify) {
      const { title, body } = pushMessages('fr').challengeClosed(result.challenge.name, rank, payout)
      await createNotification({ userId, title, message: body, metadata: { challengeId: result.challenge.id } })
      await notifySafely(userId, 'challenge_closed', result.challenge.id, locale => ({
        ...pushMessages(locale).challengeClosed(result.challenge.name, rank, payout),
        url: `/app/defis/${result.challenge.id}`,
        tag: `challenge-${result.challenge.id}`,
      }))
    }
  }

  return { closed }
}

const ERROR_RESPONSES: Record<ChallengeErrorCode, { statusCode: number, message: string }> = {
  invalid_invite: { statusCode: 404, message: 'Invitation invalide' },
  full: { statusCode: 409, message: 'Ce défi est complet' },
  already_joined: { statusCode: 409, message: 'Vous participez déjà à ce défi' },
  ended: { statusCode: 410, message: 'Ce défi est terminé' },
  insufficient_credits: { statusCode: 400, message: 'Crédits insuffisants pour la mise' },
  not_participant: { statusCode: 404, message: 'Défi introuvable' },
  closed: { statusCode: 410, message: 'Ce défi est clôturé' },
}

export function toChallengeHttpError(error: unknown): never {
  if (error instanceof ChallengeError) {
    throw createError({ ...ERROR_RESPONSES[error.code], data: { code: error.code } })
  }
  throw error
}
