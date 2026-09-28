import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import webpush from 'web-push'

// Configuration des tests E2E. Volontairement indépendante de `.env`, qui peut pointer
// vers une base distante (production) : les E2E créent des comptes et modifient des données.

export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgresql://postgres@localhost:5432/focus_e2e'
export const E2E_REDIS_URL = process.env.E2E_REDIS_URL ?? 'redis://localhost:6379/15'
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100)
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`
export const E2E_TIMEZONE = 'Europe/Paris'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres', 'redis'])

export function assertLocalServices() {
  if (process.env.E2E_ALLOW_REMOTE === '1') return

  for (const [name, url] of [['E2E_DATABASE_URL', E2E_DATABASE_URL], ['E2E_REDIS_URL', E2E_REDIS_URL]]) {
    const { hostname } = new URL(url)
    if (!LOCAL_HOSTS.has(hostname)) {
      throw new Error(
        `${name} pointe vers « ${hostname} ». Les E2E écrivent en base : utilisez un service local `
        + '(docker compose up -d) ou forcez avec E2E_ALLOW_REMOTE=1.',
      )
    }
  }
}

// Notifications push : clés VAPID et certificat du faux service push, générés une fois
// par machine dans le répertoire temporaire (rien de secret n'est versionné).
// web-push n'émet qu'en HTTPS : le serveur de test approuve ce certificat via
// NODE_EXTRA_CA_CERTS, sans désactiver la vérification TLS.
export function ensurePushTestAssets() {
  const dir = join(tmpdir(), 'focus-e2e-push')
  const certPath = join(dir, 'cert.pem')
  const keyPath = join(dir, 'key.pem')
  const vapidPath = join(dir, 'vapid.json')
  mkdirSync(dir, { recursive: true })

  if (!existsSync(certPath) || !existsSync(keyPath)) {
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes',
      '-keyout', keyPath, '-out', certPath, '-days', '365', '-subj', '/CN=localhost',
      '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
    ], { stdio: 'ignore' })
  }

  if (!existsSync(vapidPath)) {
    writeFileSync(vapidPath, JSON.stringify(webpush.generateVAPIDKeys()))
  }

  const vapid = JSON.parse(readFileSync(vapidPath, 'utf8')) as { publicKey: string, privateKey: string }
  return { certPath, keyPath, vapid }
}
