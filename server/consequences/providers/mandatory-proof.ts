import { and, eq, isNull } from 'drizzle-orm'
import { useDatabase, schema } from '../../database'
import { createNotification } from '../../utils/notifications'
import {
  mandatoryProofConfigSchema,
  type ConsequenceProvider,
  type MandatoryProofConfig,
} from '../types'

export async function getPendingProofRequirement(userId: string, goalId: string) {
  const db = useDatabase()
  const [requirement] = await db
    .select()
    .from(schema.proofRequirements)
    .where(and(
      eq(schema.proofRequirements.userId, userId),
      eq(schema.proofRequirements.goalId, goalId),
      isNull(schema.proofRequirements.consumedAt),
    ))
    .limit(1)

  return requirement ?? null
}

export async function consumeProofRequirement(requirementId: string) {
  const db = useDatabase()
  await db
    .update(schema.proofRequirements)
    .set({ consumedAt: new Date() })
    .where(eq(schema.proofRequirements.id, requirementId))
}

export const mandatoryProofProvider: ConsequenceProvider<MandatoryProofConfig> = {
  type: 'mandatory-proof',

  async validate(config: unknown): Promise<MandatoryProofConfig> {
    return mandatoryProofConfigSchema.parse(config ?? {})
  },

  async estimate() {
    return {
      label: 'Preuve obligatoire',
      description: 'Votre prochaine réussite sur cet objectif devra inclure une preuve.',
    }
  },

  async execute(payload) {
    const db = useDatabase()

    const [existing] = await db
      .select()
      .from(schema.proofRequirements)
      .where(eq(schema.proofRequirements.consequenceHistoryId, payload.historyId))
      .limit(1)

    if (existing) {
      return {
        proofRequirementId: existing.id,
        goalId: existing.goalId,
        alreadyProcessed: true,
      }
    }

    const [requirement] = await db.insert(schema.proofRequirements).values({
      userId: payload.userId,
      goalId: payload.goalId,
      consequenceHistoryId: payload.historyId,
    }).onConflictDoNothing().returning()

    if (!requirement) {
      const [retryExisting] = await db
        .select()
        .from(schema.proofRequirements)
        .where(eq(schema.proofRequirements.consequenceHistoryId, payload.historyId))
        .limit(1)

      if (!retryExisting) {
        throw new Error('Impossible d\'enregistrer l\'obligation de preuve')
      }

      return {
        proofRequirementId: retryExisting.id,
        goalId: retryExisting.goalId,
        alreadyProcessed: true,
      }
    }

    await createNotification({
      userId: payload.userId,
      title: 'Preuve obligatoire',
      message: 'Votre prochaine réussite sur cet objectif devra inclure une preuve.',
      metadata: {
        proofRequirementId: requirement.id,
        goalId: payload.goalId,
        historyId: payload.historyId,
      },
    })

    return {
      proofRequirementId: requirement.id,
      goalId: payload.goalId,
      alreadyProcessed: false,
    }
  },
}
