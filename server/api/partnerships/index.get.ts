import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { getPartnerView, getPendingInvitation } from '../../utils/partnerships'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const [view, invitation] = await Promise.all([getPartnerView(user.id), getPendingInvitation(user.id)])
  return {
    partner: view,
    invitation: invitation ? { id: invitation.id, expiresAt: invitation.expiresAt } : null,
  }
})
