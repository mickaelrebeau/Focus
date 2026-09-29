import { asc, eq, or } from 'drizzle-orm'
import { useDatabase, schema } from '../database'

export const EXPORT_FORMAT_VERSION = 1

// Clés jamais exportées, même imbriquées dans un champ JSON (metadata, config) :
// empreintes, jetons, clés push et identifiants Stripe / Google.
const SECRET_KEY_PATTERN = /password|hash|token|secret|p256dh|^auth$|paymentintent|paymentmethod|customer|transferid|googleid/i

export function isSecretKey(key: string) {
  return SECRET_KEY_PATTERN.test(key.replace(/[_-]/g, ''))
}

/** Retire récursivement les clés sensibles. Filet de sécurité : les requêtes sélectionnent déjà leurs colonnes. */
export function redactSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => redactSecrets(item)) as T
  if (value instanceof Date || value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isSecretKey(key))
      .map(([key, item]) => [key, redactSecrets(item)]),
  ) as T
}

/** Toutes les données personnelles d'un utilisateur, pour le droit d'accès et de portabilité. */
export async function buildAccountExport(userId: string) {
  const db = useDatabase()
  const t = schema

  const [user] = await db.select().from(t.users).where(eq(t.users.id, userId)).limit(1)
  if (!user) throw new Error('Utilisateur introuvable')

  const [
    wallet,
    goals,
    milestones,
    occurrences,
    postponements,
    validations,
    ledger,
    consequences,
    consequenceHistory,
    streak,
    dailyResults,
    streakRewards,
    leaderboardSnapshots,
    leaderboardRewards,
    pauses,
    partnerships,
    challenges,
    donations,
    communityPot,
    transfers,
    stripePayments,
    notifications,
    notificationPreferences,
    pushSubscriptions,
    sessions,
  ] = await Promise.all([
    db.select({ balance: t.wallets.balance, debt: t.wallets.debt, updatedAt: t.wallets.updatedAt })
      .from(t.wallets).where(eq(t.wallets.userId, userId)),
    db.select().from(t.goals).where(eq(t.goals.userId, userId)).orderBy(asc(t.goals.createdAt)),
    db.select({ milestone: t.projectMilestones })
      .from(t.projectMilestones)
      .innerJoin(t.goals, eq(t.goals.id, t.projectMilestones.goalId))
      .where(eq(t.goals.userId, userId))
      .orderBy(asc(t.projectMilestones.orderIndex)),
    db.select().from(t.occurrences).where(eq(t.occurrences.userId, userId)).orderBy(asc(t.occurrences.dueAt)),
    db.select({
      occurrenceId: t.occurrencePostponements.occurrenceId,
      weekStart: t.occurrencePostponements.weekStart,
      originalDueAt: t.occurrencePostponements.originalDueAt,
      newDueAt: t.occurrencePostponements.newDueAt,
      createdAt: t.occurrencePostponements.createdAt,
    }).from(t.occurrencePostponements).where(eq(t.occurrencePostponements.userId, userId)),
    // Sans l'identifiant du modérateur : c'est une donnée d'un autre compte
    db.select({
      id: t.validations.id,
      occurrenceId: t.validations.occurrenceId,
      status: t.validations.status,
      note: t.validations.note,
      proofType: t.validations.proofType,
      proofContent: t.validations.proofContent,
      proofUrl: t.validations.proofUrl,
      reviewedAt: t.validations.reviewedAt,
      reviewNote: t.validations.reviewNote,
      createdAt: t.validations.createdAt,
    }).from(t.validations).where(eq(t.validations.userId, userId)).orderBy(asc(t.validations.createdAt)),
    db.select({
      id: t.creditLedger.id,
      type: t.creditLedger.type,
      amount: t.creditLedger.amount,
      balanceAfter: t.creditLedger.balanceAfter,
      debtAfter: t.creditLedger.debtAfter,
      occurrenceId: t.creditLedger.occurrenceId,
      goalId: t.creditLedger.goalId,
      reason: t.creditLedger.reason,
      metadata: t.creditLedger.metadata,
      createdAt: t.creditLedger.createdAt,
    }).from(t.creditLedger).where(eq(t.creditLedger.userId, userId)).orderBy(asc(t.creditLedger.createdAt)),
    db.select().from(t.userConsequences).where(eq(t.userConsequences.userId, userId)).orderBy(asc(t.userConsequences.priority)),
    db.select().from(t.consequenceHistory).where(eq(t.consequenceHistory.userId, userId)).orderBy(asc(t.consequenceHistory.createdAt)),
    db.select().from(t.userStreaks).where(eq(t.userStreaks.userId, userId)),
    db.select().from(t.userDailyResults).where(eq(t.userDailyResults.userId, userId)).orderBy(asc(t.userDailyResults.dateKey)),
    db.select({
      milestone: t.streakRewards.milestone,
      amount: t.streakRewards.amount,
      awardedAt: t.streakRewards.awardedAt,
    }).from(t.streakRewards).where(eq(t.streakRewards.userId, userId)),
    db.select({
      weekKey: t.leaderboardDailySnapshots.weekKey,
      snapshotDate: t.leaderboardDailySnapshots.snapshotDate,
      rank: t.leaderboardDailySnapshots.rank,
      netScore: t.leaderboardDailySnapshots.netScore,
    }).from(t.leaderboardDailySnapshots).where(eq(t.leaderboardDailySnapshots.userId, userId)).orderBy(asc(t.leaderboardDailySnapshots.snapshotDate)),
    db.select({
      weekKey: t.leaderboardWeeklyRewards.weekKey,
      finalRank: t.leaderboardWeeklyRewards.finalRank,
      rewardAmount: t.leaderboardWeeklyRewards.rewardAmount,
      daysQualified: t.leaderboardWeeklyRewards.daysQualified,
      settledAt: t.leaderboardWeeklyRewards.settledAt,
    }).from(t.leaderboardWeeklyRewards).where(eq(t.leaderboardWeeklyRewards.userId, userId)),
    db.select().from(t.pausePeriods).where(eq(t.pausePeriods.userId, userId)).orderBy(asc(t.pausePeriods.startDate)),
    // Binômes : son rôle et les dates, jamais l'identité de l'autre personne
    db.select({
      inviterId: t.partnerships.inviterId,
      status: t.partnerships.status,
      createdAt: t.partnerships.createdAt,
      acceptedAt: t.partnerships.acceptedAt,
      revokedAt: t.partnerships.revokedAt,
    }).from(t.partnerships).where(or(eq(t.partnerships.inviterId, userId), eq(t.partnerships.partnerId, userId))),
    db.select({
      name: t.challenges.name,
      creatorId: t.challenges.creatorId,
      metric: t.challenges.metric,
      weekStart: t.challenges.weekStart,
      weekEnd: t.challenges.weekEnd,
      stakeCredits: t.challenges.stakeCredits,
      outcome: t.challenges.outcome,
      joinedAt: t.challengeParticipants.joinedAt,
      leftAt: t.challengeParticipants.leftAt,
      stakePaid: t.challengeParticipants.stakePaid,
      finalScore: t.challengeParticipants.finalScore,
      finalRank: t.challengeParticipants.finalRank,
      payout: t.challengeParticipants.payout,
    })
      .from(t.challengeParticipants)
      .innerJoin(t.challenges, eq(t.challenges.id, t.challengeParticipants.challengeId))
      .where(eq(t.challengeParticipants.userId, userId)),
    db.select({
      association: t.donationExecutions.association,
      amount: t.donationExecutions.amount,
      currency: t.donationExecutions.currency,
      status: t.donationExecutions.status,
      consequenceHistoryId: t.donationExecutions.consequenceHistoryId,
      createdAt: t.donationExecutions.createdAt,
    }).from(t.donationExecutions).where(eq(t.donationExecutions.userId, userId)),
    db.select({
      amount: t.communityPotTransactions.amount,
      currency: t.communityPotTransactions.currency,
      consequenceHistoryId: t.communityPotTransactions.consequenceHistoryId,
      createdAt: t.communityPotTransactions.createdAt,
    }).from(t.communityPotTransactions).where(eq(t.communityPotTransactions.userId, userId)),
    // Transferts : montant et sens, sans le compte de l'autre partie
    db.select({
      fromUserId: t.internalTransfers.fromUserId,
      amount: t.internalTransfers.amount,
      currency: t.internalTransfers.currency,
      consequenceHistoryId: t.internalTransfers.consequenceHistoryId,
      createdAt: t.internalTransfers.createdAt,
    }).from(t.internalTransfers).where(or(eq(t.internalTransfers.fromUserId, userId), eq(t.internalTransfers.toUserId, userId))),
    db.select({
      amount: t.stripePayments.amount,
      currency: t.stripePayments.currency,
      status: t.stripePayments.status,
      consequenceHistoryId: t.stripePayments.consequenceHistoryId,
      createdAt: t.stripePayments.createdAt,
    }).from(t.stripePayments).where(eq(t.stripePayments.userId, userId)),
    db.select().from(t.notifications).where(eq(t.notifications.userId, userId)).orderBy(asc(t.notifications.createdAt)),
    db.select().from(t.notificationPreferences).where(eq(t.notificationPreferences.userId, userId)),
    db.select({
      userAgent: t.pushSubscriptions.userAgent,
      createdAt: t.pushSubscriptions.createdAt,
      lastSuccessAt: t.pushSubscriptions.lastSuccessAt,
    }).from(t.pushSubscriptions).where(eq(t.pushSubscriptions.userId, userId)),
    db.select({ createdAt: t.sessions.createdAt, expiresAt: t.sessions.expiresAt })
      .from(t.sessions).where(eq(t.sessions.userId, userId)),
  ])

  const hasCard = Boolean(user.stripePaymentMethodLast4)

  return redactSecrets({
    format: 'focus-account-export',
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    profile: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      timezone: user.timezone,
      leaderboardOptIn: user.leaderboardOptIn,
      graceMinutes: user.graceMinutes,
      publicProfileSlug: user.publicSlug,
      onboardingCompleted: user.onboardingCompleted,
      // Des valeurs, pas des clés : redactSecrets retirerait une clé « password »
      loginMethods: [user.passwordHash && 'password', user.googleId && 'google'].filter(Boolean),
      // Carte : ce que Focus affiche déjà, les données bancaires restent chez Stripe
      card: hasCard
        ? {
            brand: user.stripePaymentMethodBrand,
            last4: user.stripePaymentMethodLast4,
            expMonth: user.stripePaymentMethodExpMonth,
            expYear: user.stripePaymentMethodExpYear,
          }
        : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    wallet: wallet[0] ?? null,
    goals: goals.map(goal => ({
      ...goal,
      milestones: milestones.filter(row => row.milestone.goalId === goal.id).map(row => row.milestone),
    })),
    occurrences,
    postponements,
    validations,
    creditLedger: ledger,
    consequences,
    consequenceHistory,
    streak: streak[0] ?? null,
    dailyResults,
    streakRewards,
    leaderboard: { snapshots: leaderboardSnapshots, weeklyRewards: leaderboardRewards },
    pauses,
    partnerships: partnerships.map(({ inviterId, ...row }) => ({ role: inviterId === userId ? 'inviter' : 'partner', ...row })),
    challenges: challenges.map(({ creatorId, ...row }) => ({ ...row, isCreator: creatorId === userId })),
    donations,
    communityPotContributions: communityPot,
    creditTransfers: transfers.map(({ fromUserId, ...row }) => ({ direction: fromUserId === userId ? 'sent' : 'received', ...row })),
    payments: stripePayments,
    notifications,
    notificationPreferences: notificationPreferences[0] ?? null,
    pushDevices: pushSubscriptions,
    sessions,
  })
}
