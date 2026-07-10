import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) return

  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    const value = trimmed.slice(eq + 1)
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadEnv()

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL manquant. Vérifiez votre fichier .env')
  process.exit(1)
}

const migrationsDir = resolve(process.cwd(), 'server/database/migrations')
const sqlClient = postgres(databaseUrl, { max: 1 })

try {
  await sqlClient.unsafe(`
    CREATE TABLE IF NOT EXISTS "_migrations" (
      "id" text PRIMARY KEY,
      "applied_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `)

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  let applied = 0
  let skipped = 0

  for (const file of files) {
    const [existing] = await sqlClient`
      SELECT id FROM "_migrations" WHERE id = ${file}
    `

    if (existing) {
      console.log(`↷ ${file} (déjà appliquée)`)
      skipped++
      continue
    }

    const sql = readFileSync(resolve(migrationsDir, file), 'utf-8')
    await sqlClient.unsafe(sql)
    await sqlClient`INSERT INTO "_migrations" (id) VALUES (${file})`
    console.log(`✓ ${file}`)
    applied++
  }

  if (applied === 0 && skipped > 0) {
    console.log('Base à jour — aucune nouvelle migration.')
  } else {
    console.log(`Terminé : ${applied} appliquée(s), ${skipped} ignorée(s).`)
  }
} catch (error) {
  console.error('Erreur de migration:', (error as Error).message)
  process.exit(1)
} finally {
  await sqlClient.end()
}
