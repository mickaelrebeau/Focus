import { z } from 'zod'
import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { parseBody } from '../../utils/validation'
import { setPublicProfile } from '../../utils/public-profile'
import { logAudit } from '../../utils/audit'

const publicProfileSchema = z.object({
  enabled: z.boolean(),
  // Nouveau lien : l'ancien cesse de fonctionner
  regenerate: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const data = parseBody(publicProfileSchema, await readBody(event))

  const slug = await setPublicProfile(user, data.enabled, data.regenerate)
  if (slug !== user.publicSlug) {
    await logAudit(user.id, data.enabled ? 'user.public_profile_enable' : 'user.public_profile_disable', 'user', user.id, {
      regenerated: Boolean(data.enabled && user.publicSlug),
    }, getRequestIP(event) ?? undefined)
  }
  return { publicSlug: slug }
})
