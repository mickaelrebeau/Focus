import { resetPasswordSchema, parseBody } from '../../utils/validation'
import { hashPassword } from '../../utils/password'
import { useDatabase, schema } from '../../database'
import { eq, and, isNull, gt } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const data = parseBody(resetPasswordSchema, body)

  const db = useDatabase()
  const now = new Date()

  const [resetToken] = await db
    .select()
    .from(schema.passwordResetTokens)
    .where(and(
      eq(schema.passwordResetTokens.token, data.token),
      isNull(schema.passwordResetTokens.usedAt),
      gt(schema.passwordResetTokens.expiresAt, now),
    ))
    .limit(1)

  if (!resetToken) {
    throw createError({ statusCode: 400, message: 'Lien invalide ou expiré' })
  }

  const passwordHash = await hashPassword(data.password)

  await db.transaction(async (tx) => {
    await tx
      .update(schema.users)
      .set({ passwordHash, updatedAt: now })
      .where(eq(schema.users.id, resetToken.userId))

    await tx
      .update(schema.passwordResetTokens)
      .set({ usedAt: now })
      .where(eq(schema.passwordResetTokens.id, resetToken.id))
  })

  return { success: true }
})
