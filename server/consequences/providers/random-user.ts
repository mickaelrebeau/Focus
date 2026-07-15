import { and, eq, ne, sql } from 'drizzle-orm'
import { useDatabase, schema } from '../../database'
import { applyPenalty, awardTransferReceived } from '../../utils/credits'
import { createNotification } from '../../utils/notifications'
import {
  randomUserConfigSchema,
  type ConsequenceProvider,
  type RandomUserConfig,
} from '../types'

export const randomUserProvider: ConsequenceProvider<RandomUserConfig> = {
  type: 'random-user',

  async validate(config: unknown): Promise<RandomUserConfig> {
    return randomUserConfigSchema.parse(config ?? {})
  },

  async estimate(config: RandomUserConfig, amount: number) {
    const scoreLabel = config.minimumScore > 0
      ? ` (score net minimum du destinataire : ${config.minimumScore})`
      : ''
    return {
      label: `Transfert de ${amount} crédits`,
      description: `${amount} crédits seront retirés de votre portefeuille et crédités à un utilisateur actif au hasard${scoreLabel}.`,
    }
  },

  async execute(payload) {
    if (payload.amount <= 0) {
      return { skipped: true, reason: 'Montant nul' }
    }

    const db = useDatabase()
    const minimumScore = payload.config.minimumScore ?? 0
    const credits = payload.amount

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

    const [transfer] = await db.insert(schema.internalTransfers).values({
      fromUserId: payload.userId,
      toUserId: recipient.id,
      amount: credits,
      currency: 'CREDITS',
      consequenceHistoryId: payload.historyId,
      metadata: {
        recipientDisplayName: recipient.displayName,
        minimumScore,
        goalId: payload.goalId,
        occurrenceId: payload.occurrenceId,
        credits,
      },
    }).returning()

    const senderResult = await applyPenalty(
      payload.userId,
      credits,
      payload.occurrenceId,
      payload.goalId,
    )

    const creditResult = await awardTransferReceived(
      recipient.id,
      credits,
      payload.userId,
      transfer.id,
    )

    await createNotification({
      userId: recipient.id,
      title: 'Transfert reçu',
      message: `Vous avez reçu ${credits} crédits suite à un transfert aléatoire.`,
      metadata: {
        transferId: transfer.id,
        fromUserId: payload.userId,
        credits,
      },
    })

    await createNotification({
      userId: payload.userId,
      title: 'Transfert effectué',
      message: `${credits} crédits ont été transférés à ${recipient.displayName}.`,
      metadata: {
        transferId: transfer.id,
        recipientId: recipient.id,
        credits,
      },
    })

    return {
      transferId: transfer.id,
      recipientId: recipient.id,
      recipientDisplayName: recipient.displayName,
      creditsTransferred: credits,
      senderBalanceAfter: senderResult.wallet.balance,
      senderDebtAfter: senderResult.wallet.debt,
      recipientBalanceAfter: creditResult.wallet.balance,
      recipientDebtAfter: creditResult.wallet.debt,
    }
  },
}
