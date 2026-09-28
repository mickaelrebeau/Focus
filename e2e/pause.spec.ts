import { randomBytes } from 'node:crypto'
import { test, expect, type Page } from '@playwright/test'
import postgres from 'postgres'
import { E2E_DATABASE_URL, E2E_TIMEZONE } from './env'

// Mode pause / vacances : échéances « En pause », aucune conséquence, streak gelé.
const runId = Date.now().toString(36)
const goalTitle = `Courir ${runId}`
const sql = postgres(E2E_DATABASE_URL, { max: 1, onnotice: () => {} })

test.afterAll(async () => {
  await sql.end()
})

function occurrenceCard(page: Page, title: string) {
  return page.locator('.app-row').filter({ has: page.getByRole('heading', { name: title }) })
}

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: E2E_TIMEZONE }).format(new Date())
}

test('pause planifiée : aucune échéance ne peut échouer, puis reprise', async ({ page }) => {
  const email = `pause-${runId}@focus.test`
  await expect(page.request.post('/api/auth/register', {
    data: { email, password: randomBytes(16).toString('base64url'), displayName: 'Pause' },
  })).resolves.toBeOK()
  await expect(page.request.patch('/api/user/settings', {
    data: { displayName: 'Pause', timezone: E2E_TIMEZONE, leaderboardOptIn: false },
  })).resolves.toBeOK()
  await expect(page.request.post('/api/goals', {
    data: { type: 'recurring', title: goalTitle, recurrenceType: 'daily', recurrenceConfig: { dueTime: '23:59' } },
  })).resolves.toBeOK()

  // Planification : du jour même à J+6 par défaut
  await page.goto('/app/reglages/pause')
  await expect(page.getByLabel('Début')).toHaveValue(today())
  await page.getByLabel('Motif').fill('Vacances')
  await page.getByRole('button', { name: 'Planifier la pause' }).click()
  await expect(page.getByRole('status').getByText(/Pause planifiée, 7 échéances mises en pause\./)).toBeVisible()
  await expect(page.getByText('En cours', { exact: true })).toBeVisible()

  // Espace connecté : bannière, échéance du jour « En pause », rien à valider
  await page.goto('/app')
  await expect(page.getByText('Pause en cours.')).toBeVisible()
  const card = occurrenceCard(page, goalTitle)
  await expect(card.getByText('En pause')).toBeVisible()
  await expect(card.getByRole('button', { name: `Valider ${goalTitle}` })).toHaveCount(0)

  // L'heure limite passe pendant la pause : pas d'échec, pas de conséquence
  await sql`
    UPDATE occurrences o SET due_at = now() - interval '1 minute'
    FROM goals g WHERE o.goal_id = g.id AND g.title = ${goalTitle} AND o.due_date = ${today()}
  `
  await page.goto('/app/agenda')
  await expect(occurrenceCard(page, goalTitle).getByText('En pause')).toBeVisible()
  const [consequences] = await sql`
    SELECT count(*)::int AS n FROM consequence_history h JOIN users u ON u.id = h.user_id WHERE u.email = ${email}
  `
  expect(consequences?.n).toBe(0)

  // Un objectif créé pendant la pause naît « en pause » sur la période
  const otherGoal = `Lire ${runId}`
  await expect(page.request.post('/api/goals', {
    data: { type: 'recurring', title: otherGoal, recurrenceType: 'daily', recurrenceConfig: { dueTime: '23:59' } },
  })).resolves.toBeOK()
  const [generated] = await sql`
    SELECT o.status FROM occurrences o JOIN goals g ON g.id = o.goal_id
    WHERE g.title = ${otherGoal} AND o.due_date = ${today()}
  `
  expect(generated?.status).toBe('skipped')

  // Fin de la pause (commencée aujourd'hui : annulation complète)
  await page.goto('/app/reglages/pause')
  await page.getByRole('button', { name: 'Terminer maintenant' }).click()
  await expect(page.getByRole('status').getByText('Pause annulée.')).toBeVisible()
  await expect(page.getByText('Annulée', { exact: true })).toBeVisible()

  // Les échéances encore à venir redeviennent « à faire » ; celle dont l'heure est passée reste en pause
  const statuses = await sql`
    SELECT o.due_date::text AS day, o.status FROM occurrences o JOIN goals g ON g.id = o.goal_id
    WHERE g.title = ${goalTitle} ORDER BY o.due_date LIMIT 2
  `
  expect(statuses.map(row => row.status)).toEqual(['skipped', 'pending'])

  await page.goto('/app')
  await expect(page.getByText('Pause en cours.')).toHaveCount(0)
})

test('terminer plus tôt une pause commencée avant aujourd’hui', async ({ page }) => {
  const email = `pause-early-${runId}@focus.test`
  const title = `Méditer ${runId}`
  await expect(page.request.post('/api/auth/register', {
    data: { email, password: randomBytes(16).toString('base64url'), displayName: 'Pause tôt' },
  })).resolves.toBeOK()
  await expect(page.request.patch('/api/user/settings', {
    data: { displayName: 'Pause tôt', timezone: E2E_TIMEZONE, leaderboardOptIn: false },
  })).resolves.toBeOK()
  await expect(page.request.post('/api/goals', {
    data: { type: 'recurring', title, recurrenceType: 'daily', recurrenceConfig: { dueTime: '23:59' } },
  })).resolves.toBeOK()

  // Pause commencée il y a 3 jours, prévue jusqu'à J+4 (préparée en base : l'API refuse le passé)
  const [pause] = await sql`
    INSERT INTO pause_periods (user_id, start_date, end_date, reason)
    SELECT id, ${today()}::date - 3, ${today()}::date + 4, 'Déplacement' FROM users WHERE email = ${email}
    RETURNING id, (end_date)::text AS end_date
  `
  await sql`
    UPDATE occurrences o SET status = 'skipped'
    FROM goals g WHERE o.goal_id = g.id AND g.title = ${title}
      AND o.due_date BETWEEN ${today()}::date AND ${today()}::date + 4
  `

  await page.goto('/app/reglages/pause')
  await page.getByRole('button', { name: 'Terminer maintenant' }).click()
  await expect(page.getByRole('status').getByText('Pause terminée : vos échéances à venir sont de nouveau à faire.')).toBeVisible()
  await expect(page.getByText('Terminée', { exact: true })).toBeVisible()
  await expect(page.getByText(/Terminée plus tôt \(fin prévue le/)).toBeVisible()

  const [row] = await sql`
    SELECT (end_date)::text AS end_date, (original_end_date)::text AS original_end_date, cancelled_at
    FROM pause_periods WHERE id = ${pause!.id}
  `
  expect(row?.original_end_date).toBe(pause!.end_date)
  expect(row?.cancelled_at).toBeNull()
  const [{ yesterday }] = await sql`SELECT (${today()}::date - 1)::text AS yesterday`
  expect(row?.end_date).toBe(yesterday)

  const [pending] = await sql`
    SELECT count(*)::int AS n FROM occurrences o JOIN goals g ON g.id = o.goal_id
    WHERE g.title = ${title} AND o.status = 'skipped'
  `
  expect(pending?.n).toBe(0)
})
