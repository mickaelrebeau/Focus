import { and, eq, inArray, isNotNull, isNull, lte, or } from 'drizzle-orm'
import { useDatabase, schema } from '../database'
import { logAudit } from './audit'
import { leaveChallenge } from './challenges'
import { deleteUserProofs } from './s3'
import { getStripe, isStripeConfigured } from './stripe-client'

export const DEFAULT_PURGE_DELAY_DAYS = 30

/** Délai avant purge définitive (ACCOUNT_PURGE_DELAY_DAYS, 0 = au prochain passage du worker). */
export function purgeDelayDays(raw = process.env.ACCOUNT_PURGE_DELAY_DAYS) {
  if (raw === undefined || raw.trim() === '') return DEFAULT_PURGE_DELAY_DAYS
  const days = Number(raw)
  return Number.isInteger(days) && days >= 0 ? days : DEFAULT_PURGE_DELAY_DAYS
}

export function purgeDate(deletedAt: Date, delayDays = purgeDelayDays()) {
  return new Date(deletedAt.getTime() + delayDays * 24 * 60 * 60 * 1000)
}

/**
 * Suppression demandée par l'utilisateur. Irréversible : le compte devient inaccessible,
 * plus aucune échéance ni conséquence ne s'exécute, les données hors base (preuves S3,
 * client Stripe) sont effacées tout de suite. La base est purgée plus tard par le worker.
 */
export async function softDeleteAccount(user: { id: string, timezone: string }) {
  const db = useDatabase()
  const now = new Date()

  // D'abord, quitter les défis en cours (remboursement de la mise si le défi n'a pas commencé)
  const openChallenges = await db
    .select({ challengeId: schema.challengeParticipants.challengeId })
    .from(schema.challengeParticipants)
    .innerJoin(schema.challenges, eq(schema.challenges.id, schema.challengeParticipants.challengeId))
    .where(and(
      eq(schema.challengeParticipants.userId, user.id),
      isNull(schema.challengeParticipants.leftAt),
      isNull(schema.challenges.closedAt),
    ))
  for (const { challengeId } of openChallenges) {
    await leaveChallenge(user, challengeId).catch((error) => {
      console.error('[account-deletion] Leave challenge failed:', error)
    })
  }

  const [current] = await db.transaction(async (tx) => {
    // isBlocked exclut déjà le compte des sessions, du classement, des rappels et des tirages
    const updated = await tx
      .update(schema.users)
      .set({ deletedAt: now, isBlocked: true, leaderboardOptIn: false, updatedAt: now })
      .where(and(eq(schema.users.id, user.id), isNull(schema.users.deletedAt)))
      .returning({ stripeCustomerId: schema.users.stripeCustomerId })
    if (!updated.length) return updated

    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, user.id))
    await tx.delete(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.userId, user.id))
    await tx.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, user.id))
    await tx.update(schema.goals).set({ isActive: false, updatedAt: now }).where(eq(schema.goals.userId, user.id))
    // Aucune échéance en attente ne doit échouer (et déclencher un paiement) après la demande
    await tx
      .update(schema.occurrences)
      .set({ status: 'skipped', processedAt: now })
      .where(and(eq(schema.occurrences.userId, user.id), eq(schema.occurrences.status, 'pending')))
    await tx
      .update(schema.consequenceHistory)
      .set({ status: 'cancelled' })
      .where(and(eq(schema.consequenceHistory.userId, user.id), eq(schema.consequenceHistory.status, 'pending')))
    await tx
      .update(schema.partnerships)
      .set({ status: 'revoked', revokedAt: now, revokedBy: user.id })
      .where(and(
        inArray(schema.partnerships.status, ['pending', 'active']),
        or(eq(schema.partnerships.inviterId, user.id), eq(schema.partnerships.partnerId, user.id)),
      ))
    return updated
  })

  if (!current) return null

  const cleanup: Record<string, unknown> = {}
  try {
    cleanup.proofsDeleted = await deleteUserProofs(user.id)
  } catch (error) {
    console.error('[account-deletion] Proof deletion failed:', error)
    cleanup.proofsError = true
  }

  if (current.stripeCustomerId && isStripeConfigured()) {
    try {
      // Supprime aussi les moyens de paiement enregistrés chez Stripe
      await getStripe().customers.del(current.stripeCustomerId)
      cleanup.stripeCustomerDeleted = true
    } catch (error) {
      console.error('[account-deletion] Stripe customer deletion failed:', error)
      cleanup.stripeError = true
    }
  }

  await db
    .update(schema.users)
    .set({
      stripeCustomerId: null,
      stripePaymentMethodId: null,
      stripePaymentMethodBrand: null,
      stripePaymentMethodLast4: null,
      stripePaymentMethodExpMonth: null,
      stripePaymentMethodExpYear: null,
    })
    .where(eq(schema.users.id, user.id))

  await logAudit(null, 'user.self_delete', 'user', user.id, cleanup)
  return { purgeAt: purgeDate(now) }
}

/** Purge définitive des comptes supprimés depuis plus de ACCOUNT_PURGE_DELAY_DAYS jours (worker). */
export async function purgeDeletedAccounts(now = new Date(), delayDays = purgeDelayDays()) {
  const cutoff = new Date(now.getTime() - delayDays * 24 * 60 * 60 * 1000)
  // Les tables liées suivent par ON DELETE CASCADE / SET NULL (0017_account_deletion.sql)
  const purged = await useDatabase()
    .delete(schema.users)
    .where(and(isNotNull(schema.users.deletedAt), lte(schema.users.deletedAt, cutoff)))
    .returning({ id: schema.users.id })

  for (const { id } of purged) {
    await logAudit(null, 'user.purge', 'user', id)
  }
  return { purged: purged.length }
}
