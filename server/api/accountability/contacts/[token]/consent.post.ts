import { z } from 'zod'
import { parseBody } from '../../../../utils/validation'
import { logAudit } from '../../../../utils/audit'
import { setContactConsent, toAccountabilityHttpError } from '../../../../utils/accountability'

const consentSchema = z.object({ accept: z.boolean() })

// Second opt-in du contact : accepter, refuser ou se désinscrire. Consentement horodaté et audité.
export default defineEventHandler(async (event) => {
  const { accept } = parseBody(consentSchema, await readBody(event))
  try {
    const contact = await setContactConsent(getRouterParam(event, 'token') ?? '', accept)
    await logAudit(null, accept ? 'accountability.contact_confirm' : 'accountability.contact_decline', 'accountability_contact', contact.id, {
      userId: contact.userId,
    }, getRequestIP(event) ?? undefined)
    return { status: contact.status }
  } catch (error) {
    toAccountabilityHttpError(error)
  }
})
