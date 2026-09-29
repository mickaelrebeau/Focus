import { defineConfig, devices } from '@playwright/test'
import { E2E_BASE_URL, E2E_DATABASE_URL, E2E_MAIL_DIR, E2E_PORT, E2E_REDIS_URL, E2E_TIMEZONE, assertLocalServices, ensurePushTestAssets } from './e2e/env'

assertLocalServices()
const pushAssets = ensurePushTestAssets()

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: E2E_BASE_URL,
    timezoneId: E2E_TIMEZONE,
    locale: 'fr-FR',
    // Le service worker PWA mettrait des réponses en cache entre deux étapes
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // Build dédié : `--dotenv` évite que le `.env` du développeur soit intégré au build
    command: 'pnpm exec nuxt build --dotenv e2e/e2e.env && node .output/server/index.mjs',
    url: E2E_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: 'pipe',
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      REDIS_URL: E2E_REDIS_URL,
      PORT: String(E2E_PORT),
      NUXT_ADMIN_EMAIL: 'e2e-admin@focus.test',
      NUXT_ADMIN_PASSWORD: '',
      NUXT_STRIPE_SECRET_KEY: '',
      NUXT_GOOGLE_CLIENT_SECRET: '',
      NUXT_S3_SECRET_KEY: '',
      NUXT_USERJOT_SECRET_KEY: '',
      // La suite crée plus de comptes que la limite de production (10 / heure / IP)
      REGISTER_RATE_LIMIT: '500',
      LOGIN_RATE_LIMIT: '500',
      MAIL_OUTBOX_DIR: E2E_MAIL_DIR,
      APP_URL: E2E_BASE_URL,
      VAPID_PUBLIC_KEY: pushAssets.vapid.publicKey,
      VAPID_PRIVATE_KEY: pushAssets.vapid.privateKey,
      VAPID_SUBJECT: 'mailto:e2e@focus.test',
      // Faux service push HTTPS des tests (e2e/push.spec.ts)
      NODE_EXTRA_CA_CERTS: pushAssets.certPath,
    },
  },
})
