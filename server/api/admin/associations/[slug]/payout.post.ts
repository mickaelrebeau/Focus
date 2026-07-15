import { z } from 'zod'
import { getUserFromEvent, requireAuth, requireAdmin } from '../../../../utils/auth'
import { parseBody } from '../../../../utils/validation'
import { recordAssociationPayout } from '../../../../utils/association-pot'
import { useDatabase, schema } from '../../../../database'

const payoutSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  amountCents: z.number().int().min(1),
  notes: z.string().max(500).optional(),
})

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(requireAuth(await getUserFromEvent(event)))
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, message: 'Slug requis' })

  const body = await readBody(event)
  const data = parseBody(payoutSchema, body)

  try {
    const payout = await recordAssociationPayout({
      associationSlug: slug,
      period: data.period,
      amountCents: data.amountCents,
      adminId: admin.id,
      notes: data.notes,
    })

    const db = useDatabase()
    await db.insert(schema.auditLogs).values({
      actorId: admin.id,
      action: 'association_pot_payout',
      entityType: 'association_pot_payout',
      entityId: payout.id,
      details: {
        associationSlug: slug,
        period: data.period,
        amountCents: data.amountCents,
        notes: data.notes,
      },
    })

    return { payout }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible d\'enregistrer le reversement'
    throw createError({ statusCode: 400, message })
  }
})
