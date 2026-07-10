import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let client: ReturnType<typeof postgres> | null = null
let db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function useDatabase() {
  if (!db) {
    const config = useRuntimeConfig()
    if (!config.databaseUrl) {
      throw createError({ statusCode: 500, message: 'DATABASE_URL non configurée' })
    }
    client = postgres(config.databaseUrl, { max: 10 })
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
