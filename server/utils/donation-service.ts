import { eq } from 'drizzle-orm'
import { useDatabase, schema } from '../database'
import { getActiveAssociationBySlug } from './associations'
import { createNotification } from './notifications'
import { formatEuroAmount } from '../consequences/types'

export async function processDonationExecution(input: {
  userId: string
  association: string
  amountCents: number
  historyId: string
  paymentIntentId: string
}) {
  const association = await getActiveAssociationBySlug(input.association)
  if (!association) {
    throw new Error('Association invalide ou inactive')
  }

  const db = useDatabase()

  const [existing] = await db
    .select()
    .from(schema.donationExecutions)
    .where(eq(schema.donationExecutions.consequenceHistoryId, input.historyId))
    .limit(1)

  if (existing) {
    return {
      executionId: existing.id,
      status: existing.status,
      associationLabel: association.name,
      alreadyProcessed: true,
    }
  }

  const [execution] = await db.insert(schema.donationExecutions).values({
    userId: input.userId,
    association: input.association,
    amount: input.amountCents,
    consequenceHistoryId: input.historyId,
    stripePaymentIntentId: input.paymentIntentId,
    status: 'accumulated',
    metadata: {
      associationLabel: association.name,
    },
  }).onConflictDoNothing().returning()

  if (!execution) {
    const [retryExisting] = await db
      .select()
      .from(schema.donationExecutions)
      .where(eq(schema.donationExecutions.consequenceHistoryId, input.historyId))
      .limit(1)

    if (!retryExisting) {
      throw new Error('Impossible d\'enregistrer la contribution')
    }

    return {
      executionId: retryExisting.id,
      status: retryExisting.status,
      associationLabel: association.name,
      alreadyProcessed: true,
    }
  }

  await createNotification({
    userId: input.userId,
    title: 'Don enregistré',
    message: `Votre don de ${formatEuroAmount(input.amountCents)} a été ajouté à la cagnotte de ${association.name}.`,
    metadata: {
      donationExecutionId: execution.id,
      association: input.association,
      amountCents: input.amountCents,
      status: 'accumulated',
    },
  })

  return {
    executionId: execution.id,
    status: 'accumulated' as const,
    associationLabel: association.name,
    alreadyProcessed: false,
  }
}
