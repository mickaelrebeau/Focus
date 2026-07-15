import { z } from 'zod'
import { getUserFromEvent, requireAuth, requireAdmin } from '../../../utils/auth'
import { parseBody } from '../../../utils/validation'
import { useDatabase, schema } from '../../../database'

const createAssociationSchema = z.object({
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug invalide'),
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional(),
  logoUrl: z.string().url().optional(),
  enabled: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
})

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(requireAuth(await getUserFromEvent(event)))
  const body = await readBody(event)
  const data = parseBody(createAssociationSchema, body)
  const db = useDatabase()

  const [association] = await db.insert(schema.associations).values({
    slug: data.slug,
    name: data.name,
    description: data.description,
    logoUrl: data.logoUrl,
    enabled: data.enabled,
    sortOrder: data.sortOrder,
  }).returning()

  await db.insert(schema.auditLogs).values({
    actorId: admin.id,
    action: 'association.create',
    entityType: 'association',
    entityId: association.slug,
    details: {
      name: association.name,
      enabled: association.enabled,
    },
  })

  return { association }
})
