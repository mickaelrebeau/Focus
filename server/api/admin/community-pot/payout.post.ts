import { z } from 'zod'
import { getUserFromEvent, requireAuth, requireAdmin } from '../../../utils/auth'
import { parseBody } from '../../../utils/validation'
import { useDatabase, schema } from '../../../database'
import { isValidActiveAssociationSlug } from '../../../utils/associations'

const payoutSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  association: z.string().min(1),
  amountCents: z.number().int().min(1),
  notes: z.string().max(500).optional(),
})

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(requireAuth(await getUserFromEvent(event)))
  const body = await readBody(event)
  const data = parseBody(payoutSchema, body)

  const validAssociation = await isValidActiveAssociationSlug(data.association)
  if (!validAssociation) {
    throw createError({ statusCode: 400, message: 'Association invalide' })
  }

  const db = useDatabase()
  const [payout] = await db.insert(schema.communityPotPayouts).values({
    period: data.period,
    association: data.association,
    amount: data.amountCents,
    adminId: admin.id,
    notes: data.notes,
  }).returning()

  await db.insert(schema.auditLogs).values({
    actorId: admin.id,
    action: 'community_pot_payout',
    entityType: 'community_pot_payout',
    entityId: payout.id,
    details: {
      period: data.period,
      association: data.association,
      amountCents: data.amountCents,
      notes: data.notes,
    },
  })

  return { payout }
})
