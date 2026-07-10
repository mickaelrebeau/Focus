import { eq } from 'drizzle-orm'
import { getUserFromEvent, requireAuth, requireAdmin } from '../../../../utils/auth'
import { useDatabase, schema } from '../../../../database'
import { adminReviewSchema, parseBody } from '../../../../utils/validation'
import { applyPenalty } from '../../../../utils/credits'
import { logAudit } from '../../../../utils/audit'

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(requireAuth(await getUserFromEvent(event)))
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID requis' })

  const body = await readBody(event)
  const data = parseBody(adminReviewSchema, body)
  const db = useDatabase()
  const now = new Date()

  const [row] = await db
    .select({
      validation: schema.validations,
      occurrence: schema.occurrences,
      goal: schema.goals,
    })
    .from(schema.validations)
    .innerJoin(schema.occurrences, eq(schema.validations.occurrenceId, schema.occurrences.id))
    .innerJoin(schema.goals, eq(schema.occurrences.goalId, schema.goals.id))
    .where(eq(schema.validations.id, id))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, message: 'Validation introuvable' })

  await db
    .update(schema.validations)
    .set({
      status: data.status,
      reviewedBy: admin.id,
      reviewedAt: now,
      reviewNote: data.reviewNote,
    })
    .where(eq(schema.validations.id, id))

  if (data.status === 'rejected') {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.occurrences)
        .set({ status: 'failed', processedAt: now })
        .where(eq(schema.occurrences.id, row.occurrence.id))

      await applyPenalty(
        row.occurrence.userId,
        row.goal.penaltyCredits,
        row.occurrence.id,
        row.goal.id,
      )
    })
  }

  await logAudit(admin.id, 'validation.review', 'validation', id, data, getRequestIP(event) ?? undefined)

  return { success: true }
})
