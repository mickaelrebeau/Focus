import { ConsequenceError, toHttpError } from '../consequences/errors'
import { and, asc, eq } from 'drizzle-orm'
import { useDatabase, schema } from '../database'
import { getConsequenceProvider } from '../consequences/registry'
import { isMonetaryProvider, isNonMonetaryBehaviorProvider, type ConsequenceProviderKey } from '../consequences/types'
import { enqueueConsequenceJob } from './consequences-queue'

interface FailureContext {
  userId: string
  goalId: string
  occurrenceId: string
}

export function validateConsequenceAmount(type: ConsequenceProviderKey, amount: number): void {
  if (type === 'custom' || isNonMonetaryBehaviorProvider(type)) return
  if (type === 'credits' && amount < 1) {
    throw new ConsequenceError('Le montant en crédits doit être au moins 1')
  }
  if (isMonetaryProvider(type) && amount < 100) {
    throw new ConsequenceError('Le montant minimum est de 1 €')
  }
}

export async function validateConsequenceConfig(
  type: ConsequenceProviderKey,
  config: unknown,
): Promise<Record<string, unknown>> {
  const provider = getConsequenceProvider(type)
  const validated = await provider.validate(config)
  return validated as Record<string, unknown>
}

export async function validateUserConsequenceInput(
  type: ConsequenceProviderKey,
  amount: number,
  config: unknown,
): Promise<Record<string, unknown>> {
  try {
    validateConsequenceAmount(type, amount)
    return await validateConsequenceConfig(type, config)
  } catch (error) {
    toHttpError(error)
  }
}

export async function triggerConsequencesOnFailure(context: FailureContext) {
  const db = useDatabase()

  const activeConsequences = await db
    .select()
    .from(schema.userConsequences)
    .where(and(
      eq(schema.userConsequences.userId, context.userId),
      eq(schema.userConsequences.enabled, true),
    ))
    .orderBy(asc(schema.userConsequences.priority))

  if (activeConsequences.length === 0) {
    return { enqueued: 0, historyIds: [] as string[] }
  }

  const historyIds: string[] = []

  await db.transaction(async (tx) => {
    for (const consequence of activeConsequences) {
      const [history] = await tx
        .insert(schema.consequenceHistory)
        .values({
          goalId: context.goalId,
          userId: context.userId,
          userConsequenceId: consequence.id,
          occurrenceId: context.occurrenceId,
          provider: consequence.type,
          status: 'pending',
          amount: consequence.amount,
          metadata: { config: consequence.config },
        })
        .onConflictDoNothing()
        .returning({ id: schema.consequenceHistory.id })

      if (history) {
        historyIds.push(history.id)
      }
    }
  })

  for (const historyId of historyIds) {
    await enqueueConsequenceJob(historyId)
  }

  return { enqueued: historyIds.length, historyIds }
}

export async function executeConsequenceHistory(historyId: string) {
  const db = useDatabase()
  const now = new Date()

  let shouldExecute = false
  let historyRow: typeof schema.consequenceHistory.$inferSelect | null = null

  await db.transaction(async (tx) => {
    const [history] = await tx
      .select()
      .from(schema.consequenceHistory)
      .where(eq(schema.consequenceHistory.id, historyId))
      .for('update')

    if (!history) return
    if (history.status === 'completed' || history.status === 'cancelled') return
    if (history.status === 'processing') return

    await tx
      .update(schema.consequenceHistory)
      .set({ status: 'processing' })
      .where(eq(schema.consequenceHistory.id, historyId))

    historyRow = history
    shouldExecute = true
  })

  if (!shouldExecute || !historyRow) {
    return { skipped: true }
  }

  const history = historyRow
  const config = (history.metadata?.config ?? {}) as Record<string, unknown>

  try {
    const provider = getConsequenceProvider(history.provider)
    const validatedConfig = await provider.validate(config)
    const result = await provider.execute({
      historyId: history.id,
      userId: history.userId,
      goalId: history.goalId,
      occurrenceId: history.occurrenceId,
      amount: history.amount,
      config: validatedConfig,
      metadata: history.metadata ?? undefined,
    })

    await db
      .update(schema.consequenceHistory)
      .set({
        status: 'completed',
        executedAt: now,
        metadata: {
          ...history.metadata,
          result,
        },
      })
      .where(eq(schema.consequenceHistory.id, historyId))

    return { success: true, result }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'

    console.error(`[Consequences] Échec history=${historyId} provider=${history.provider}:`, errorMessage)

    await db
      .update(schema.consequenceHistory)
      .set({
        status: 'failed',
        executedAt: now,
        metadata: {
          ...history.metadata,
          error: errorMessage,
        },
      })
      .where(eq(schema.consequenceHistory.id, historyId))

    throw error
  }
}

export async function recoverPendingConsequenceJobs() {
  const db = useDatabase()
  const pending = await db
    .select({ id: schema.consequenceHistory.id })
    .from(schema.consequenceHistory)
    .where(eq(schema.consequenceHistory.status, 'pending'))

  let recovered = 0
  for (const row of pending) {
    await enqueueConsequenceJob(row.id)
    recovered++
  }

  return { recovered }
}
