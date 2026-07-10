import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../server/database/schema'
import { seedDemoData } from '../server/utils/seed-demo'

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
const adminEmail = process.env.ADMIN_EMAIL || 'rebeau.mickael@gmail.com'
const force = process.argv.includes('--force')

if (!databaseUrl) {
  console.error('DATABASE_URL manquant. Vérifiez votre fichier .env')
  process.exit(1)
}

const client = postgres(databaseUrl, { max: 1 })
const db = drizzle(client, { schema })

try {
  const result = await seedDemoData(db, adminEmail, force)

  if (result.skipped) {
    console.log(`↷ ${result.reason}`)
    console.log('   Relancez avec --force pour réinitialiser les données démo.')
  } else {
    console.log('✓ Données factices injectées avec succès')
    console.log(`  Admin : ${result.adminEmail}`)
    console.log(`  Objectifs : ${result.goals}`)
    console.log(`  Échéances : ${result.occurrences}`)
    console.log(`  Utilisateurs démo : ${result.demoUsers}`)
    console.log('  Comptes démo : mot de passe Demo1234!')
  }
} catch (error) {
  console.error('Erreur :', (error as Error).message)
  process.exit(1)
} finally {
  await client.end()
}
