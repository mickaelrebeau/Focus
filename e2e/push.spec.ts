import { createECDH, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import https from 'node:https'
import type { AddressInfo } from 'node:net'
import { test, expect, type Page } from '@playwright/test'
// @ts-expect-error pas de types publiés
import ece from 'http_ece'
import postgres from 'postgres'
import { E2E_DATABASE_URL, E2E_TIMEZONE, ensurePushTestAssets } from './env'

// Notifications push, de l'abonnement à la réception :
// navigateur (PushManager simulé) → API → envoi VAPID chiffré → faux service push HTTPS.
// Chromium complet (nouveau headless) : le shell headless allégé refuse toujours les notifications
test.use({ channel: 'chromium', serviceWorkers: 'allow', permissions: ['notifications'] })
test.describe.configure({ mode: 'serial' })

interface CapturedPush {
  path: string
  headers: Record<string, string | string[] | undefined>
  payload: { title: string, body: string, url?: string }
}

const assets = ensurePushTestAssets()
const received: CapturedPush[] = []
let pushServer: https.Server
let endpointBase = ''

// Clés de l'appareil simulé : le serveur chiffre avec, le test déchiffre
const device = createECDH('prime256v1')
device.generateKeys()
const authSecret = randomBytes(16)
const deviceKeys = {
  p256dh: device.getPublicKey().toString('base64url'),
  auth: authSecret.toString('base64url'),
}

const runId = Date.now().toString(36)
const endpoint = () => `${endpointBase}/push/${runId}`
const sql = postgres(E2E_DATABASE_URL, { max: 1, onnotice: () => {} })

test.beforeAll(async () => {
  pushServer = https.createServer({
    key: readFileSync(assets.keyPath),
    cert: readFileSync(assets.certPath),
  }, (request, response) => {
    const chunks: Buffer[] = []
    request.on('data', chunk => chunks.push(chunk))
    request.on('end', () => {
      const plaintext = ece.decrypt(Buffer.concat(chunks), {
        version: 'aes128gcm',
        privateKey: device,
        authSecret: authSecret.toString('base64url'),
      })
      received.push({ path: request.url ?? '', headers: request.headers, payload: JSON.parse(plaintext.toString('utf8')) })
      response.writeHead(201).end()
    })
  })
  await new Promise<void>(resolve => pushServer.listen(0, '127.0.0.1', resolve))
  endpointBase = `https://localhost:${(pushServer.address() as AddressInfo).port}`

  // Le processus de test appelle aussi le job de rappels : il doit approuver le certificat
  https.globalAgent.options.ca = readFileSync(assets.certPath)
})

test.afterAll(async () => {
  await sql.end()
  await new Promise(resolve => pushServer.close(resolve))
})

// Chromium headless n'a pas de service push : on simule l'abonnement du navigateur,
// avec des clés réelles pour que le chiffrement de bout en bout soit vérifié.
async function stubPushManager(page: Page) {
  await page.addInitScript(({ url, keys }) => {
    // Persisté entre les pages, comme un vrai abonnement navigateur
    const storageKey = 'e2e-push-subscribed'
    const fake = {
      endpoint: url,
      expirationTime: null,
      options: {},
      getKey: () => null,
      toJSON: () => ({ endpoint: url, expirationTime: null, keys }),
      unsubscribe: async () => {
        localStorage.removeItem(storageKey)
        return true
      },
    } as unknown as PushSubscription
    PushManager.prototype.getSubscription = async () => (localStorage.getItem(storageKey) ? fake : null)
    PushManager.prototype.subscribe = async () => {
      localStorage.setItem(storageKey, '1')
      return fake
    }
  }, { url: endpoint(), keys: deviceKeys })
}

async function waitForPush(predicate: (push: CapturedPush) => boolean) {
  await expect.poll(() => received.find(predicate), { timeout: 10_000 }).toBeTruthy()
  return received.find(predicate)!
}

async function signUp(page: Page) {
  const password = randomBytes(16).toString('base64url')
  await expect(page.request.post('/api/auth/register', {
    data: { email: `push-${runId}@focus.test`, password, displayName: 'Push' },
  })).resolves.toBeOK()
  await expect(page.request.patch('/api/user/settings', {
    data: { displayName: 'Push', timezone: E2E_TIMEZONE, leaderboardOptIn: false },
  })).resolves.toBeOK()
}

test('abonnement explicite, notification de test chiffrée, préférences et désabonnement', async ({ page }) => {
  await stubPushManager(page)
  await signUp(page)

  await page.goto('/app/reglages/notifications')
  await page.evaluate(() => navigator.serviceWorker.ready)

  // Consentement : rien n'est actif tant que l'utilisateur n'a pas cliqué
  await expect(page.getByText('Aucune notification n\'est envoyée sans votre accord.', { exact: false })).toBeVisible()
  expect(received).toHaveLength(0)

  await page.getByRole('button', { name: 'Activer les notifications' }).click()
  await expect(page.getByText('Notifications activées sur cet appareil.')).toBeVisible()
  const [row] = await sql`SELECT count(*)::int AS n FROM push_subscriptions WHERE endpoint = ${endpoint()}`
  expect(row?.n).toBe(1)

  await page.getByRole('button', { name: 'Envoyer une notification de test' }).click()
  await expect(page.getByRole('status').getByText('Notification de test envoyée.')).toBeVisible()
  const testPush = await waitForPush(push => push.payload.title === 'Notifications activées')
  expect(testPush.headers['content-encoding']).toBe('aes128gcm')
  expect(String(testPush.headers.authorization)).toMatch(/^vapid t=.+, k=.+/)
  expect(testPush.payload.url).toBe('/app/reglages/notifications')

  // Préférence persistée
  await page.getByRole('switch', { name: 'Streak en danger' }).click()
  await expect(page.getByRole('status').getByText('Préférences enregistrées.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('switch', { name: 'Streak en danger' })).toHaveAttribute('aria-checked', 'false')

  // Le service worker affiche la notification reçue (push-sw.js importé par Workbox)
  const cdp = await page.context().newCDPSession(page)
  const registrationId = await new Promise<string>((resolve) => {
    cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
      const active = registrations.find((item: { isDeleted: boolean }) => !item.isDeleted)
      if (active) resolve(active.registrationId)
    })
    void cdp.send('ServiceWorker.enable')
  })
  // Livré à chaque tentative : juste après un rechargement, le worker peut être en transition.
  // Le tag commun évite tout doublon d'affichage.
  await expect.poll(async () => {
    await cdp.send('ServiceWorker.deliverPushMessage', {
      origin: new URL(page.url()).origin,
      registrationId,
      data: JSON.stringify({ title: 'Échéance bientôt', body: 'Test', url: '/app', tag: 'e2e' }),
    })
    return page.evaluate(async () =>
      (await (await navigator.serviceWorker.ready).getNotifications()).map(n => n.title))
  }).toContain('Échéance bientôt')

  // Déconnexion : l'appareil est désabonné côté serveur
  await page.goto('/app/reglages')
  await page.getByRole('button', { name: 'Déconnexion' }).click()
  await expect(page).toHaveURL(/\/connexion$/)
  const [after] = await sql`SELECT count(*)::int AS n FROM push_subscriptions WHERE endpoint = ${endpoint()}`
  expect(after?.n).toBe(0)
})

test('rappel avant échéance envoyé une seule fois par le job', async ({ page }) => {
  await stubPushManager(page)
  const title = `Appeler le client ${runId}`

  // Nouveau compte abonné, avec un objectif ponctuel qui échoit dans 30 minutes
  const password = randomBytes(16).toString('base64url')
  await expect(page.request.post('/api/auth/register', {
    data: { email: `push-job-${runId}@focus.test`, password, displayName: 'Push job' },
  })).resolves.toBeOK()
  await expect(page.request.patch('/api/user/settings', {
    data: { displayName: 'Push job', timezone: E2E_TIMEZONE, leaderboardOptIn: false },
  })).resolves.toBeOK()
  const due = new Date(Date.now() + 30 * 60_000)
  const [dueDate, dueTime] = new Intl.DateTimeFormat('sv-SE', {
    timeZone: E2E_TIMEZONE, dateStyle: 'short', timeStyle: 'short',
  }).format(due).split(' ')
  await expect(page.request.post('/api/goals', { data: { type: 'one_time', title, dueDate, dueTime } })).resolves.toBeOK()

  await page.goto('/app/reglages/notifications')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.getByRole('button', { name: 'Activer les notifications' }).click()
  await expect(page.getByText('Notifications activées sur cet appareil.')).toBeVisible()

  // Le job du worker, exécuté ici contre la base E2E
  process.env.DATABASE_URL = E2E_DATABASE_URL
  process.env.VAPID_PUBLIC_KEY = assets.vapid.publicKey
  process.env.VAPID_PRIVATE_KEY = assets.vapid.privateKey
  process.env.VAPID_SUBJECT = 'mailto:e2e@focus.test'
  const { processPushReminders } = await import('../server/utils/push')

  const first = await processPushReminders()
  expect(first.reminders).toBeGreaterThanOrEqual(1)
  const reminder = await waitForPush(push => push.payload.body.includes(title))
  expect(reminder.payload.title).toBe('Échéance bientôt')
  expect(reminder.payload.body).toMatch(/dans (29|30) min/)

  const count = received.filter(push => push.payload.body.includes(title)).length
  await processPushReminders()
  expect(received.filter(push => push.payload.body.includes(title))).toHaveLength(count)

  const { closeDatabase } = await import('../server/database')
  await closeDatabase()
})
