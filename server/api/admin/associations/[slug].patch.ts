import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getUserFromEvent, requireAuth, requireAdmin } from '../../../utils/auth'
import { parseBody } from '../../../utils/validation'
import { useDatabase, schema } from '../../../database'
import { getAssociationBySlug } from '../../../utils/associations'

const updateAssociationSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(requireAuth(await getUserFromEvent(event)))
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, message: 'Slug requis' })

  const existing = await getAssociationBySlug(slug)
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Association introuvable' })
  }

  const body = await readBody(event)
  const data = parseBody(updateAssociationSchema, body)
  const db = useDatabase()

  const [association] = await db
    .update(schema.associations)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(schema.associations.slug, slug))
    .returning()

  await db.insert(schema.auditLogs).values({
    actorId: admin.id,
    action: 'association.update',
    entityType: 'association',
    entityId: slug,
    details: data,
  })

  return { association }
})
