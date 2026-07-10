import { forgotPasswordSchema, parseBody } from '../../utils/validation'
import { generateToken } from '../../utils/password'
import { useDatabase, schema } from '../../database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const data = parseBody(forgotPasswordSchema, body)

  const db = useDatabase()
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, data.email.toLowerCase()))
    .limit(1)

  // Always return success to prevent email enumeration
  if (user) {
    const token = generateToken()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)

    await db.insert(schema.passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
    })

    // In production, send email here. For MVP, log token in dev.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Reset token for ${user.email}: ${token}`)
    }
  }

  return { success: true, message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' }
})
