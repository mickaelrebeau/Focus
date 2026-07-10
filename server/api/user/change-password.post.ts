import { eq } from 'drizzle-orm'
import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { useDatabase, schema } from '../../database'
import { changePasswordSchema, parseBody } from '../../utils/validation'
import { hashPassword, verifyPassword } from '../../utils/password'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const data = parseBody(changePasswordSchema, await readBody(event))
  const db = useDatabase()

  const [dbUser] = await db
    .select({ passwordHash: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1)

  if (!dbUser || !(await verifyPassword(data.currentPassword, dbUser.passwordHash))) {
    throw createError({ statusCode: 400, message: 'Mot de passe actuel incorrect' })
  }

  const passwordHash = await hashPassword(data.newPassword)

  await db
    .update(schema.users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(schema.users.id, user.id))

  return { success: true }
})
