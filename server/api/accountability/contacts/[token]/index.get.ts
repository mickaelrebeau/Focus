import { getContactByToken, toAccountabilityHttpError } from '../../../../utils/accountability'

// Page du contact (sans compte) : qui l'invite, et où en est son consentement
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  try {
    const { contact, userName } = await getContactByToken(getRouterParam(event, 'token') ?? '')
    return { userName, contactName: contact.name, status: contact.status }
  } catch (error) {
    toAccountabilityHttpError(error)
  }
})
