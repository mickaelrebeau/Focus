import { randomBytes } from 'node:crypto'
import { test, expect, type Page } from '@playwright/test'
import postgres from 'postgres'
import { E2E_DATABASE_URL, E2E_TIMEZONE } from './env'

// Heure limite contextuelle : presets par catégorie, suggestion d'après l'historique,
// et report d'un jour limité (1 par semaine), audité, sans échec ni conséquence.
const runId = Date.now().toString(36)
const sql = postgres(E2E_DATABASE_URL, { max: 1, onnotice: () => {} })

test.afterAll(async () => {
  await sql.end()
})

function localDate(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: E2E_TIMEZONE }).format(date)
}

async function signUp(page: Page, name: string) {
  const email = `due-${name}-${runId}@focus.test`
  await expect(page.request.post('/api/auth/register', {
    data: { email, password: randomBytes(16).toString('base64url'), displayName: name },
  })).resolves.toBeOK()
  await expect(page.request.patch('/api/user/settings', {
    data: { displayName: name, timezone: E2E_TIMEZONE, leaderboardOptIn: false },
  })).resolves.toBeOK()
  const [user] = await sql`SELECT id FROM users WHERE email = ${email}`
  return user!.id as string
}

async function createDailyGoal(page: Page, title: string, category?: string) {
  const response = await page.request.post('/api/goals', {
    data: { type: 'recurring', title, category, recurrenceType: 'daily', recurrenceConfig: { dueTime: '23:59' } },
  })
  await expect(response).toBeOK()
  const { goal } = await response.json()
  return goal.id as string
}

function occurrenceCard(page: Page, title: string) {
  return page.locator('.app-row').filter({ has: page.getByRole('heading', { name: title }) })
}

test('presets par catégorie et suggestion d’après l’historique', async ({ page }) => {
  const userId = await signUp(page, 'slots')

  // Sans historique : presets de la catégorie, pas de suggestion
  await page.goto('/app/objectifs/nouveau')
  await page.getByRole('button', { name: /Récurrent/ }).click()
  await page.getByLabel('Catégorie').fill('Sport')
  const suggestions = page.getByTestId('due-time-suggestions')
  await expect(suggestions.getByText('Pour « Sport »')).toBeVisible()
  await suggestions.getByRole('button', { name: 'Matin · 07:00' }).click()
  await expect(page.getByLabel('Heure limite')).toHaveValue('07:00')
  await expect(suggestions.getByText('Pas encore assez d\'historique pour comparer vos créneaux.')).toBeVisible()

  // Historique « Sport » : 6 réussites le matin (07:00), 6 échecs la nuit (23:59)
  const goalId = await createDailyGoal(page, `Historique ${runId}`, 'Sport')
  for (let day = 1; day <= 12; day++) {
    const morning = day <= 6
    await sql`
      INSERT INTO occurrences (goal_id, user_id, due_date, due_at, status, processed_at)
      VALUES (
        ${goalId}, ${userId}, ${localDate(-day)}::date,
        (${localDate(-day)}::date + ${morning ? '07:00' : '23:59'}::time) AT TIME ZONE ${E2E_TIMEZONE},
        ${morning ? 'completed' : 'failed'}, now()
      )
    `
  }

  await page.reload()
  await page.getByRole('button', { name: /Récurrent/ }).click()
  await page.getByLabel('Catégorie').fill('Sport')
  await expect(suggestions.getByText('sur vos objectifs « Sport », 90 derniers jours')).toBeVisible()
  await expect(suggestions.getByText('100 % · 6 échéances', { exact: true })).toBeVisible()
  await expect(suggestions.getByText('0 % · 6 échéances', { exact: true })).toBeVisible()
  await suggestions.getByRole('button', { name: 'Suggestion : 07:00 (matin, 100 % de réussite)' }).click()
  await expect(page.getByLabel('Heure limite')).toHaveValue('07:00')
})

test('report d’un jour : limité, audité, sans échec ni conséquence', async ({ page }) => {
  const userId = await signUp(page, 'postpone')
  const first = `Lire ${runId}`
  const second = `Écrire ${runId}`
  const expired = `Courir ${runId}`
  await createDailyGoal(page, first)
  await createDailyGoal(page, second)
  await createDailyGoal(page, expired)

  // Une échéance expirée ne se reporte pas (aucune conséquence ne doit être contournée)
  const [expiredOccurrence] = await sql`
    UPDATE occurrences o SET due_at = now() - interval '1 minute'
    FROM goals g WHERE o.goal_id = g.id AND g.title = ${expired} AND o.due_date = ${localDate()}
    RETURNING o.id
  `
  const refused = await page.request.post(`/api/occurrences/${expiredOccurrence!.id}/postpone`)
  expect(refused.status()).toBe(409)
  expect((await refused.json()).data.code).toBe('expired')

  // Report depuis l'accueil, avec confirmation
  await page.goto('/app')
  const card = occurrenceCard(page, first)
  await card.getByRole('button', { name: 'Reporter d\'un jour' }).click()
  await expect(card.getByText('1 report par semaine')).toBeVisible()
  await card.getByRole('button', { name: 'Confirmer le report' }).click()
  await expect(card.getByText('Reportée d\'un jour')).toBeVisible()

  const [postponed] = await sql`
    SELECT o.id, o.due_date::text AS due_date, o.due_at, o.original_due_at
    FROM occurrences o JOIN goals g ON g.id = o.goal_id
    WHERE g.title = ${first} AND o.original_due_at IS NOT NULL
  `
  expect(postponed!.due_date).toBe(localDate())
  expect(postponed!.due_at.getTime() - postponed!.original_due_at.getTime()).toBe(24 * 60 * 60 * 1000)
  const [audit] = await sql`
    SELECT details FROM audit_logs WHERE action = 'occurrence.postpone' AND entity_id = ${postponed!.id}
  `
  expect(audit!.details).toMatchObject({ dueDate: localDate() })

  // Quota atteint : plus de bouton, et l'API refuse un second report cette semaine
  await expect(occurrenceCard(page, second).getByRole('button', { name: 'Reporter d\'un jour' })).toHaveCount(0)
  const [other] = await sql`
    SELECT o.id FROM occurrences o JOIN goals g ON g.id = o.goal_id WHERE g.title = ${second} AND o.due_date = ${localDate()}
  `
  const quota = await page.request.post(`/api/occurrences/${other!.id}/postpone`)
  expect(quota.status()).toBe(409)
  expect((await quota.json()).data.code).toBe('quota_reached')
  const again = await page.request.post(`/api/occurrences/${postponed!.id}/postpone`)
  expect((await again.json()).data.code).toBe('already_postponed')

  // Le lendemain (simulé) : l'échéance reportée d'hier est dans « Aujourd'hui », la journée
  // d'hier reste ouverte, puis passe en réussite une fois l'échéance validée
  await sql`UPDATE occurrences SET due_date = ${localDate(-1)}::date WHERE id = ${postponed!.id}`
  await sql`DELETE FROM occurrences WHERE user_id = ${userId} AND due_date = ${localDate(-1)}::date AND id <> ${postponed!.id}`
  const today = await (await page.request.get('/api/occurrences?filter=today')).json()
  expect(today.occurrences.map((occurrence: { id: string }) => occurrence.id)).toContain(postponed!.id)
  const [openDay] = await sql`SELECT status FROM user_daily_results WHERE user_id = ${userId} AND date_key = ${localDate(-1)}::date`
  expect(openDay?.status).not.toBe('failed')

  await expect(page.request.post(`/api/occurrences/${postponed!.id}/complete`, { data: {} })).resolves.toBeOK()
  const [closedDay] = await sql`SELECT status FROM user_daily_results WHERE user_id = ${userId} AND date_key = ${localDate(-1)}::date`
  expect(closedDay?.status).toBe('success')
  const [consequences] = await sql`SELECT count(*)::int AS n FROM consequence_history WHERE occurrence_id = ${postponed!.id}`
  expect(consequences!.n).toBe(0)
})
