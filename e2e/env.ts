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
