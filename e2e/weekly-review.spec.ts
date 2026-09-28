import { randomBytes } from 'node:crypto'
import { test, expect } from '@playwright/test'
import postgres from 'postgres'
import { E2E_DATABASE_URL, E2E_TIMEZONE } from './env'

// Bilan hebdomadaire : les chiffres affichés doivent correspondre au registre et aux résultats quotidiens.
const runId = Date.now().toString(36)
const sql = postgres(E2E_DATABASE_URL, { max: 1, onnotice: () => {} })

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test.afterAll(async () => {
  await sql.end()
})

test('agrégats conformes au registre, export CSV, navigation et partage', async ({ page }) => {
  const email = `bilan-${runId}@focus.test`
  await expect(page.request.post('/api/auth/register', {
    data: { email, password: randomBytes(16).toString('base64url'), displayName: 'Bilan' },
  })).resolves.toBeOK()
  await expect(page.request.patch('/api/user/settings', {
    data: { displayName: 'Bilan', timezone: E2E_TIMEZONE, leaderboardOptIn: false },
  })).resolves.toBeOK()

  // Une échéance réussie…
  const done = `Réussi ${runId}`
  await expect(page.request.post('/api/goals', {
    data: { type: 'recurring', title: done, recurrenceType: 'daily', recurrenceConfig: { dueTime: '23:59' } },
  })).resolves.toBeOK()
  const { occurrences } = await (await page.request.get('/api/occurrences?filter=today')).json()
  await expect(page.request.post(`/api/occurrences/${occurrences[0].id}/complete`, { data: {} })).resolves.toBeOK()

  // … et une échéance échouée (heure limite dépassée), qui déclenche la conséquence par défaut
  const missed = `Manqué ${runId}`
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: E2E_TIMEZONE }).format(new Date())
  await expect(page.request.post('/api/goals', { data: { type: 'one_time', title: missed, dueDate: today } })).resolves.toBeOK()
  await sql`
    UPDATE occurrences o SET due_at = now() - interval '1 minute'
    FROM goals g WHERE o.goal_id = g.id AND g.title = ${missed}
  `
  await page.request.get('/api/occurrences') // synchronisation à la lecture : l'échéance échoue

  // Valeurs attendues, recalculées directement depuis la base
  const [expected] = await sql`
    WITH u AS (SELECT id FROM users WHERE email = ${email})
    SELECT
      (SELECT count(*) FILTER (WHERE status = 'completed') FROM occurrences WHERE user_id = (SELECT id FROM u))::int AS completed,
      (SELECT count(*) FILTER (WHERE status = 'failed') FROM occurrences WHERE user_id = (SELECT id FROM u) AND due_date <= ${today})::int AS failed,
      (SELECT coalesce(sum(amount), 0) FROM credit_ledger WHERE user_id = (SELECT id FROM u)
        AND amount > 0 AND type NOT IN ('debt_created', 'debt_repayment'))::int AS gained,
      (SELECT coalesce(sum(abs(amount)), 0) FROM credit_ledger WHERE user_id = (SELECT id FROM u)
        AND amount < 0 AND type NOT IN ('debt_created', 'debt_repayment'))::int AS lost,
      (SELECT count(*) FROM consequence_history WHERE user_id = (SELECT id FROM u) AND status <> 'cancelled')::int AS consequences,
      (SELECT status::text FROM user_daily_results WHERE user_id = (SELECT id FROM u) AND date_key = ${today}) AS today_status
  `
  expect(expected).toMatchObject({ completed: 1, failed: 1, consequences: 1, today_status: 'failed' })

  await page.goto('/app/bilan')
  await expect(page.getByTestId('stat-rate')).toContainText(`${Math.round(100 * expected!.completed / (expected!.completed + expected!.failed))} %`)
  await expect(page.getByTestId('stat-rate')).toContainText(`Réussies : ${expected!.completed} sur ${expected!.completed + expected!.failed} clôturées`)
  await expect(page.getByTestId('stat-days')).toContainText('1 jour échoué')
  await expect(page.getByTestId('stat-credits')).toContainText(`+${expected!.gained} gagnés · −${expected!.lost} perdus`)
  await expect(page.getByTestId('consequences')).toContainText('× 1')
  await expect(page.getByText('En cours', { exact: true })).toBeVisible()

  // Export CSV : échéances et mouvements de crédits de la semaine
  const csv = await page.request.get('/api/bilan/export')
  expect(csv.headers()['content-type']).toContain('text/csv')
  expect(csv.headers()['content-disposition']).toMatch(/attachment; filename="focus-bilan-\d{4}-\d{2}-\d{2}\.csv"/)
  const body = await csv.text()
  expect(body.startsWith('﻿')).toBe(true)
  expect(body).toContain(`echeance,${done},completed,`)
  expect(body).toContain(`echeance,${missed},failed,`)
  expect(body).toContain(',signup_bonus,50')
  expect(body).not.toContain('Bilan <') // aucune donnée d'un autre utilisateur ou HTML

  // Partage : texte copié (pas de Web Share API sur Chromium desktop)
  await page.getByRole('button', { name: 'Partager mon bilan' }).click()
  await expect(page.getByRole('status').getByText('Bilan copié dans le presse-papiers.')).toBeVisible()
  const shared = await page.evaluate(() => navigator.clipboard.readText())
  expect(shared).toContain('50 % de réussite (1/2)')

  // Semaine précédente : aucune donnée, pas de semaine future au-delà de la courante
  const label = await page.getByTestId('week-label').textContent()
  await page.getByRole('link', { name: 'Semaine précédente' }).click()
  await expect(page.getByTestId('week-label')).not.toHaveText(label!)
  await expect(page.getByTestId('stat-rate')).toContainText('—')
  await page.getByRole('link', { name: 'Semaine suivante' }).click()
  await expect(page.getByTestId('week-label')).toHaveText(label!)
  await expect(page.getByRole('link', { name: 'Semaine suivante' })).toHaveCount(0)
})
