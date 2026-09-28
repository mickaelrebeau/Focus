import { spawnSync } from 'node:child_process'
import postgres from 'postgres'
import { E2E_DATABASE_URL, assertLocalServices } from './env'

export default async function globalSetup() {
  assertLocalServices()

  // Crée la base E2E si besoin, en se connectant à la base d'administration `postgres`
  const url = new URL(E2E_DATABASE_URL)
  const databaseName = url.pathname.slice(1)
  url.pathname = '/postgres'

  const admin = postgres(url.toString(), { max: 1, onnotice: () => {} })
  try {
    const [existing] = await admin`SELECT 1 FROM pg_database WHERE datname = ${databaseName}`
    if (!existing) {
      await admin.unsafe(`CREATE DATABASE "${databaseName.replace(/"/g, '""')}"`)
    }
  } finally {
    await admin.end()
  }

  const migration = spawnSync('pnpm', ['exec', 'tsx', 'scripts/migrate.ts'], {
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    stdio: 'inherit',
  })
  if (migration.status !== 0) {
    throw new Error('Échec des migrations de la base E2E')
  }
}
