import { eq, and } from 'drizzle-orm'
import { getUserFromEvent, requireAuth } from '../../../utils/auth'
import { useDatabase, schema } from '../../../database'
import { completeOccurrenceSchema, parseBody } from '../../../utils/validation'
import { rewardCompletion } from '../../../utils/credits'
import { syncTodayStreak } from '../../../utils/streaks'
import { consumeProofRequirement, getPendingProofRequirement } from '../../../consequences/providers/mandatory-proof'

function hasProofPayload(data: {
  proofType?: 'text' | 'url' | 'image'
  proofContent?: string
  proofUrl?: string
}) {
  if (!data.proofType) return false
  if (data.proofType === 'text') return Boolean(data.proofContent?.trim())
  if (data.proofType === 'url') return Boolean(data.proofUrl?.trim())
  if (data.proofType === 'image') return Boolean(data.proofUrl?.trim())
  return false
}

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID requis' })

  const body = await readBody(event)
  const data = parseBody(completeOccurrenceSchema, body)
  const db = useDatabase()

  const [row] = await db
    .select({
      occurrence: schema.occurrences,
      goal: schema.goals,
    })
    .from(schema.occurrences)
    .innerJoin(schema.goals, eq(schema.occurrences.goalId, schema.goals.id))
    .where(and(
      eq(schema.occurrences.id, id),
      eq(schema.occurrences.userId, user.id),
      eq(schema.occurrences.status, 'pending'),
    ))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, message: 'Échéance introuvable ou déjà traitée' })

  const proofRequirement = await getPendingProofRequirement(user.id, row.goal.id)
  if (proofRequirement && !hasProofPayload(data)) {
    throw createError({
      statusCode: 400,
      message: 'Une preuve est obligatoire pour valider cette réussite',
    })
  }

  const now = new Date()

  await db.transaction(async (tx) => {
    await tx
      .update(schema.occurrences)
      .set({ status: 'completed', processedAt: now })
      .where(eq(schema.occurrences.id, id))

    await tx.insert(schema.validations).values({
      occurrenceId: id,
      userId: user.id,
      status: 'pending_review',
      note: data.note,
      proofType: data.proofType,
      proofContent: data.proofContent,
      proofUrl: data.proofUrl,
    })
  })

  if (proofRequirement) {
    await consumeProofRequirement(proofRequirement.id)
  }

  await rewardCompletion(user.id, row.goal.rewardCredits, id, row.goal.id)

  const timezone = user.timezone ?? 'Europe/Paris'
  const streakResult = await syncTodayStreak(user.id, timezone)

  return {
    success: true,
    creditsEarned: row.goal.rewardCredits,
    streak: streakResult.dailyPerfect ? streakResult : null,
    proofRequired: Boolean(proofRequirement),
  }
})
