import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let client: ReturnType<typeof postgres> | null = null
let db: ReturnType<typeof drizzle<typeof schema>> | null = null

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  try {
    const config = useRuntimeConfig()
    if (config.databaseUrl) {
      return config.databaseUrl
    }
  } catch {
    // Hors contexte Nitro (workers standalone)
  }

  throw new Error('DATABASE_URL non configurée')
}

export function useDatabase() {
  if (!db) {
    const databaseUrl = getDatabaseUrl()
    client = postgres(databaseUrl, { max: 10 })
    db = drizzle(client, { schema })
  }
  return db
}

export async function closeDatabase() {
  if (client) {
    await client.end()
    client = null
    db = null
  }
}

export { schema }
