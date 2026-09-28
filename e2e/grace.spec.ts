import { randomBytes } from 'node:crypto'
import { test, expect, type Page } from '@playwright/test'
import Redis from 'ioredis'
import postgres from 'postgres'
import { E2E_DATABASE_URL, E2E_REDIS_URL, E2E_TIMEZONE } from './env'

// Délai de grâce : « En retard » dès l'heure limite, échec seulement après la grâce,
// avec la même règle pour la synchronisation à la lecture et pour le worker.
test.describe.configure({ mode: 'serial' })

const runId = Date.now().toString(36)
const email = `grace-${runId}@focus.test`
const sql = postgres(E2E_DATABASE_URL, { max: 1, onnotice: () => {} })

test.afterAll(async () => {
  await sql.end()
})

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: E2E_TIMEZONE }).format(new Date())
}

async function createDueGoal(page: Page, title: string) {
  await expect(page.request.post('/api/goals', { data: { type: 'one_time', title, dueDate: today(), dueTime: '23:59' } })).resolves.toBeOK()
}

async function setDueMinutesAgo(title: string, minutes: number) {
  await sql`
    UPDATE occurrences o SET due_at = now() - make_interval(mins => ${minutes})
    FROM goals g WHERE o.goal_id = g.id AND g.title = ${title}
  `
}

async function statusOf(title: string) {
  const [row] = await sql`SELECT o.status::text AS status FROM occurrences o JOIN goals g ON g.id = o.goal_id WHERE g.title = ${title}`
  return row?.status
}

function occurrenceCard(page: Page, title: string) {
  return page.locator('.app-row').filter({ has: page.getByRole('heading', { name: title }) })
}

test('réglage persisté, puis grâce respectée par la synchronisation à la lecture', async ({ page }) => {
  await expect(page.request.post('/api/auth/register', {
    data: { email, password: randomBytes(16).toString('base64url'), displayName: 'Grâce' },
  })).resolves.toBeOK()
  await expect(page.request.patch('/api/user/settings', {
    data: { displayName: 'Grâce', timezone: E2E_TIMEZONE, leaderboardOptIn: false },
  })).resolves.toBeOK()

  // Défaut = 0, puis réglage à 60 minutes via l'interface
  expect((await (await page.request.get('/api/auth/me')).json()).user.graceMinutes).toBe(0)
  await page.goto('/app/reglages')
  await page.getByLabel('Délai de grâce avant échec').selectOption('60')
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click()
  await expect(page.getByText('Réglages enregistrés.')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Délai de grâce avant échec')).toHaveValue('60')

  // Heure limite dépassée depuis 5 min : en retard, pas échouée, encore validable
  const inGrace = `Dans la grâce ${runId}`
  await createDueGoal(page, inGrace)
  await setDueMinutesAgo(inGrace, 5)
  await page.goto('/app')
  const card = occurrenceCard(page, inGrace)
  await expect(card.getByText('En retard')).toBeVisible()
  await expect(card.getByText(/échec à \d{2}:\d{2}/)).toBeVisible()
  expect(await statusOf(inGrace)).toBe('pending')

  await card.getByRole('button', { name: `Valider ${inGrace}` }).click()
  await page.getByRole('dialog').getByRole('button', { name: /^Valider \(\+\d+\)$/ }).click()
  await expect(card.getByText('Réussi')).toBeVisible()

  // Heure limite dépassée depuis 61 min : grâce écoulée, échec
  const pastGrace = `Grâce écoulée ${runId}`
  await createDueGoal(page, pastGrace)
  await setDueMinutesAgo(pastGrace, 61)
  await page.request.get('/api/occurrences')
  expect(await statusOf(pastGrace)).toBe('failed')
})

test('le worker applique la même règle', async () => {
  process.env.DATABASE_URL = E2E_DATABASE_URL
  process.env.REDIS_URL = E2E_REDIS_URL
  const { processExpiredOccurrences } = await import('../server/utils/goals-service')

  const [user] = await sql`SELECT id FROM users WHERE email = ${email}`
  const [goal] = await sql`
    INSERT INTO goals (user_id, title, type, due_date) VALUES (${user!.id}, ${`Worker ${runId}`}, 'one_time', ${today()})
    RETURNING id
  `
  await sql`
    INSERT INTO occurrences (goal_id, user_id, due_date, due_at, status)
    VALUES (${goal!.id}, ${user!.id}, ${today()}, now() - interval '10 minutes', 'pending')
  `

  await processExpiredOccurrences()
  expect(await statusOf(`Worker ${runId}`)).toBe('pending')

  await setDueMinutesAgo(`Worker ${runId}`, 70)
  await processExpiredOccurrences()
  expect(await statusOf(`Worker ${runId}`)).toBe('failed')

  const { closeDatabase } = await import('../server/database')
  await closeDatabase()
})

test('une échéance de la veille encore dans sa grâce ne clôture pas le jour en échec', async ({ page }) => {
  // Connexion du même utilisateur (session propre à ce test)
  const [user] = await sql`SELECT id FROM users WHERE email = ${email}`
  const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: E2E_TIMEZONE }).format(new Date(Date.now() - 86_400_000))
  const title = `Veille ${runId}`
  const [goal] = await sql`
    INSERT INTO goals (user_id, title, type, due_date) VALUES (${user!.id}, ${title}, 'one_time', ${yesterday}) RETURNING id
  `
  // Cas « 23:59 + 60 min vu à 00:30 » : jour passé, échéance dans sa grâce
  await sql`
    INSERT INTO occurrences (goal_id, user_id, due_date, due_at, status)
    VALUES (${goal!.id}, ${user!.id}, ${yesterday}, now() - interval '10 minutes', 'pending')
  `

  const password = randomBytes(16).toString('base64url')
  const { hashPassword } = await import('../server/utils/password')
  await sql`UPDATE users SET password_hash = ${await hashPassword(password)} WHERE id = ${user!.id}`
  await expect(page.request.post('/api/auth/login', { data: { email, password } })).resolves.toBeOK()

  // Force une synchronisation complète (sinon limitée à une par minute)
  const redis = new Redis(E2E_REDIS_URL)
  await redis.del(`sync-deadlines:last:${user!.id}`)
  await page.request.get('/api/occurrences')

  const [closed] = await sql`
    SELECT status::text AS status FROM user_daily_results WHERE user_id = ${user!.id} AND date_key = ${yesterday}
  `
  expect(closed?.status).not.toBe('failed')
  expect(await statusOf(title)).toBe('pending')

  // Grâce écoulée : échec, et le jour est clôturé en échec
  await setDueMinutesAgo(title, 120)
  await redis.del(`sync-deadlines:last:${user!.id}`)
  await page.request.get('/api/occurrences')
  expect(await statusOf(title)).toBe('failed')
  const [after] = await sql`
    SELECT status::text AS status FROM user_daily_results WHERE user_id = ${user!.id} AND date_key = ${yesterday}
  `
  expect(after?.status).toBe('failed')
  redis.disconnect()
})
