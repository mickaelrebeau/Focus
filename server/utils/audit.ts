import { eq } from 'drizzle-orm'
import { useDatabase, schema } from '../database'

export async function logAudit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId?: string,
  details?: Record<string, unknown>,
  ipAddress?: string,
) {
  const db = useDatabase()
  await db.insert(schema.auditLogs).values({
    actorId: actorId ?? undefined,
    action,
    entityType,
    entityId,
    details,
    ipAddress,
  })
}

export async function seedAdminIfNeeded() {
  const config = useRuntimeConfig()
  if (!config.adminEmail || !config.adminPassword) return

  const db = useDatabase()
  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, config.adminEmail))
    .limit(1)

  if (existing) {
    if (existing.role !== 'admin') {
      await db.update(schema.users).set({ role: 'admin' }).where(eq(schema.users.id, existing.id))
    }
    return
  }

  const { hashPassword } = await import('./password')
  const passwordHash = await hashPassword(config.adminPassword)

  const [admin] = await db.insert(schema.users).values({
    email: config.adminEmail,
    passwordHash,
    displayName: 'Administrateur',
    role: 'admin',
    onboardingCompleted: true,
  }).returning()

  await db.insert(schema.wallets).values({
    userId: admin.id,
    balance: 100,
    debt: 0,
  })

  await db.insert(schema.creditLedger).values({
    userId: admin.id,
    type: 'signup_bonus',
    amount: 100,
    balanceAfter: 100,
    debtAfter: 0,
    reason: 'Crédits initiaux administrateur',
  })
}
