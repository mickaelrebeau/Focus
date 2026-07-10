import { seedAdminIfNeeded } from '../utils/audit'

export default defineNitroPlugin(async () => {
  try {
    await seedAdminIfNeeded()
  } catch (error) {
    console.warn('[Focus] Seed admin skipped:', (error as Error).message)
  }
})
