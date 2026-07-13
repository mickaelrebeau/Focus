import { and, eq, ne, sql } from 'drizzle-orm'
import { useDatabase, schema } from '../../database'
import { chargeUserForConsequence } from '../../utils/consequence-payment'
import { awardTransferReceived, euroCentsToCredits } from '../../utils/credits'
import { createNotification } from '../../utils/notifications'
import {
  randomUserConfigSchema,
  type ConsequenceProvider,
  type RandomUserConfig,
  formatEuroAmount,
} from '../types'

export const randomUserProvider: ConsequenceProvider<RandomUserConfig> = {
  type: 'random-user',

  async validate(config: unknown): Promise<RandomUserConfig> {
    return randomUserConfigSchema.parse(config ?? {})
  },

  async estimate(config: RandomUserConfig, amount: number) {
    const scoreLabel = config.minimumScore > 0
      ? ` (score net minimum : ${config.minimumScore})`
      : ''
    return {
      label: `Transfert de ${formatEuroAmount(amount)}`,
      description: `Un prélèvement de ${formatEuroAmount(amount)} sera effectué et crédité automatiquement à un utilisateur actif aléatoire${scoreLabel}.`,
    }
  },

  async execute(payload) {
    const payment = await chargeUserForConsequence('random-user', payload)
    const db = useDatabase()
    const minimumScore = payload.config.minimumScore ?? 0

    const eligibleUsers = await db
      .select({
        id: schema.users.id,
        displayName: schema.users.displayName,
        balance: schema.wallets.balance,
        debt: schema.wallets.debt,
      })
      .from(schema.users)
      .innerJoin(schema.wallets, eq(schema.wallets.userId, schema.users.id))
      .where(and(
        eq(schema.users.isBlocked, false),
        ne(schema.users.id, payload.userId),
        sql`(${schema.wallets.balance} - ${schema.wallets.debt}) >= ${minimumScore}`,
      ))

    if (eligibleUsers.length === 0) {
      throw new Error('Aucun utilisateur éligible trouvé pour le transfert')
    }

    const recipient = eligibleUsers[Math.floor(Math.random() * eligibleUsers.length)]!
    const creditsAwarded = euroCentsToCredits(payload.amount)

    const [transfer] = await db.insert(schema.internalTransfers).values({
      fromUserId: payload.userId,
      toUserId: recipient.id,
      amount: payload.amount,
      currency: 'EUR',
      consequenceHistoryId: payload.historyId,
      metadata: {
        recipientDisplayName: recipient.displayName,
        minimumScore,
        goalId: payload.goalId,
        occurrenceId: payload.occurrenceId,
        paymentIntentId: payment.paymentIntentId,
        creditsAwarded,
      },
    }).returning()

    const creditResult = await awardTransferReceived(
      recipient.id,
      creditsAwarded,
      payload.userId,
      payload.amount,
      transfer.id,
    )

    await createNotification({
      userId: recipient.id,
      title: 'Transfert reçu',
      message: `Vous avez reçu ${creditsAwarded} crédits suite à un transfert aléatoire.`,
      metadata: {
        transferId: transfer.id,
        fromUserId: payload.userId,
        amountCents: payload.amount,
        creditsAwarded,
      },
    })

    await createNotification({
      userId: payload.userId,
      title: 'Transfert effectué',
      message: `${formatEuroAmount(payload.amount)} ont été prélevés et transférés à ${recipient.displayName} (${creditsAwarded} crédits).`,
      metadata: {
        transferId: transfer.id,
        recipientId: recipient.id,
        amountCents: payload.amount,
        creditsAwarded,
      },
    })

    return {
      transferId: transfer.id,
      recipientId: recipient.id,
      recipientDisplayName: recipient.displayName,
      amountCents: payload.amount,
      creditsAwarded,
      recipientBalanceAfter: creditResult.wallet.balance,
      currency: 'EUR',
      paymentIntentId: payment.paymentIntentId,
      recordId: payment.recordId,
    }
  },
}
