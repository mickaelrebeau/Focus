import { getUserFromEvent, requireAuth, requireAdmin } from '../../../utils/auth'
import { getAdminAssociationPots, getAssociationPayoutHistory } from '../../../utils/association-pot'

export default defineEventHandler(async (event) => {
  requireAdmin(requireAuth(await getUserFromEvent(event)))

  const associations = await getAdminAssociationPots()
  const payouts = await getAssociationPayoutHistory(undefined, 50)

  return {
    associations,
    payouts,
  }
})
