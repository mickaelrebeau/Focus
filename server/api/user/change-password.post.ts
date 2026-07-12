import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { useDatabase, schema } from '../../database'
import { parseBody, passwordSchema } from '../../utils/validation'
import { hashPassword, verifyPassword } from '../../utils/password'

const setPasswordSchema = z.object({
  newPassword: passwordSchema,
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: passwordSchema,
}).refine(data => data.currentPassword !== data.newPassword, {
  message: 'Le nouveau mot de passe doit être différent',
  path: ['newPassword'],
})

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const body = await readBody(event)
  const db = useDatabase()

  const [dbUser] = await db
    .select({ passwordHash: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1)

  if (!dbUser) {
    throw createError({ statusCode: 404, message: 'Utilisateur introuvable' })
  }

  if (!dbUser.passwordHash) {
    const data = parseBody(setPasswordSchema, body)
    const passwordHash = await hashPassword(data.newPassword)

    await db
      .update(schema.users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(schema.users.id, user.id))

    return { success: true }
  }

  const data = parseBody(changePasswordSchema, body)

  if (!(await verifyPassword(data.currentPassword, dbUser.passwordHash))) {
    throw createError({ statusCode: 400, message: 'Mot de passe actuel incorrect' })
  }

  const passwordHash = await hashPassword(data.newPassword)

  await db
    .update(schema.users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(schema.users.id, user.id))

  return { success: true }
})
