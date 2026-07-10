import { seedAdminIfNeeded } from '../utils/audit'
import { closeDatabase } from '../database'

export default defineNitroPlugin(async (nitroApp) => {
  nitroApp.hooks.hook('close', closeDatabase)

  try {
    await seedAdminIfNeeded()
  } catch (error) {
    console.warn('[Focus] Seed admin skipped:', (error as Error).message)
  }
})
