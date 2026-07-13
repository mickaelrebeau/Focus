import { and, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { schema } from '../database'

type Db = PostgresJsDatabase<typeof schema>

export const DEFAULT_CREDITS_CONSEQUENCE_AMOUNT = 20

export async function ensureDefaultCreditsConsequence(
  userId: string,
  dbInstance?: Db,
) {
  const { useDatabase } = await import('../database')
  const db = dbInstance ?? useDatabase()

  const [existingCredits] = await db
    .select({ id: schema.userConsequences.id })
    .from(schema.userConsequences)
    .where(and(
      eq(schema.userConsequences.userId, userId),
      eq(schema.userConsequences.type, 'credits'),
    ))
    .limit(1)

  if (existingCredits) return

  await db.insert(schema.userConsequences).values({
    userId,
    type: 'credits',
    enabled: true,
    amount: DEFAULT_CREDITS_CONSEQUENCE_AMOUNT,
    priority: 0,
    config: {},
  }).onConflictDoNothing()
}
