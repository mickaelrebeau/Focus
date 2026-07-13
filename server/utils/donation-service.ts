import { DONATION_ASSOCIATIONS, getDonationAssociationConnectAccountId } from '#shared/donation-associations'
import { useDatabase, schema } from '../database'
import { getStripe } from './stripe-client'
import { createNotification } from './notifications'
import { formatEuroAmount } from '../consequences/types'

export async function processDonationExecution(input: {
  userId: string
  association: string
  amountCents: number
  historyId: string
  paymentIntentId: string
}) {
  const associationInfo = DONATION_ASSOCIATIONS.find(item => item.value === input.association)
  const associationLabel = associationInfo?.label ?? input.association
  const connectAccountId = getDonationAssociationConnectAccountId(input.association)

  let status = 'recorded'
  let stripeTransferId: string | null = null

  if (connectAccountId) {
    try {
      const stripe = getStripe()
      const transfer = await stripe.transfers.create({
        amount: input.amountCents,
        currency: 'eur',
        destination: connectAccountId,
        transfer_group: input.paymentIntentId,
        metadata: {
          userId: input.userId,
          association: input.association,
          historyId: input.historyId,
        },
      }, {
        idempotencyKey: `donation-${input.historyId}`,
      })

      status = 'transferred'
      stripeTransferId = transfer.id
    } catch (error) {
      status = 'transfer_failed'
      console.error('[Donation] Transfert Stripe Connect échoué:', error)
    }
  }

  const db = useDatabase()
  const [execution] = await db.insert(schema.donationExecutions).values({
    userId: input.userId,
    association: input.association,
    amount: input.amountCents,
    consequenceHistoryId: input.historyId,
    stripePaymentIntentId: input.paymentIntentId,
    stripeTransferId,
    status,
    metadata: {
      associationLabel,
      connectAccountConfigured: Boolean(connectAccountId),
    },
  }).returning()

  await createNotification({
    userId: input.userId,
    title: 'Don effectué',
    message: status === 'transferred'
      ? `Votre don de ${formatEuroAmount(input.amountCents)} à ${associationLabel} a été versé automatiquement.`
      : `Votre don de ${formatEuroAmount(input.amountCents)} à ${associationLabel} a été enregistré et sera reversé par la plateforme.`,
    metadata: {
      donationExecutionId: execution.id,
      association: input.association,
      amountCents: input.amountCents,
      status,
    },
  })

  return {
    executionId: execution.id,
    status,
    stripeTransferId,
    associationLabel,
  }
}
