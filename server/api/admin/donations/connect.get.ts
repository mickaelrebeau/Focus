import { getUserFromEvent, requireAuth, requireAdmin } from '../../../utils/auth'
import { getDonationAssociationConnectStatus } from '#shared/donation-associations'

export default defineEventHandler(async (event) => {
  requireAdmin(requireAuth(await getUserFromEvent(event)))

  return {
    associations: getDonationAssociationConnectStatus(),
  }
})
