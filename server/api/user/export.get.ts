import { getUserFromEvent, requireAuth } from '../../utils/auth'
import { buildAccountExport } from '../../utils/account-export'
import { logAudit } from '../../utils/audit'

// Droit d'accès et de portabilité (RGPD) : toutes les données du compte, en JSON
export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const data = await buildAccountExport(user.id)
  await logAudit(user.id, 'user.export', 'user', user.id, undefined, getRequestIP(event) ?? undefined)

  const day = new Date().toISOString().slice(0, 10)
  setHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="focus-export-${day}.json"`)
  setHeader(event, 'Cache-Control', 'no-store')
  return JSON.stringify(data, null, 2)
})
