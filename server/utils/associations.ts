import { and, asc, eq } from 'drizzle-orm'
import { useDatabase, schema } from '../database'

export async function listActiveAssociations() {
  const db = useDatabase()
  return db
    .select({
      slug: schema.associations.slug,
      name: schema.associations.name,
      description: schema.associations.description,
      logoUrl: schema.associations.logoUrl,
      sortOrder: schema.associations.sortOrder,
    })
    .from(schema.associations)
    .where(eq(schema.associations.enabled, true))
    .orderBy(asc(schema.associations.sortOrder), asc(schema.associations.name))
}

export async function listAllAssociations() {
  const db = useDatabase()
  return db
    .select()
    .from(schema.associations)
    .orderBy(asc(schema.associations.sortOrder), asc(schema.associations.name))
}

export async function getAssociationBySlug(slug: string) {
  const db = useDatabase()
  const [association] = await db
    .select()
    .from(schema.associations)
    .where(eq(schema.associations.slug, slug))
    .limit(1)

  return association ?? null
}

export async function getActiveAssociationBySlug(slug: string) {
  const db = useDatabase()
  const [association] = await db
    .select()
    .from(schema.associations)
    .where(and(
      eq(schema.associations.slug, slug),
      eq(schema.associations.enabled, true),
    ))
    .limit(1)

  return association ?? null
}

export async function isValidActiveAssociationSlug(slug: string): Promise<boolean> {
  const association = await getActiveAssociationBySlug(slug)
  return Boolean(association)
}
