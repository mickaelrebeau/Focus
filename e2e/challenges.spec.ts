import { randomBytes } from 'node:crypto'
import { test, expect, type APIRequestContext } from '@playwright/test'
import postgres from 'postgres'
import { E2E_DATABASE_URL, E2E_REDIS_URL, E2E_TIMEZONE } from './env'

// Défis hebdo entre amis : mise en crédits, invitation par lien, classement en direct,
// départ (remboursé avant le début), clôture idempotente et gains au registre.
const runId = Date.now().toString(36)
const sql = postgres(E2E_DATABASE_URL, { max: 1, onnotice: () => {} })

test.afterAll(async () => {
  await sql.end()
})

async function signUp(request: APIRequestContext, name: string) {
  await expect(request.post('/api/auth/register', {
    data: { email: `defi-${name.toLowerCase()}-${runId}@focus.test`, password: randomBytes(16).toString('base64url'), displayName: name },
  })).resolves.toBeOK()
  await expect(request.patch('/api/user/settings', {
    data: { displayName: name, timezone: E2E_TIMEZONE, leaderboardOptIn: false },
  })).resolves.toBeOK()
}

async function balanceOf(name: string) {
  const [row] = await sql`
    SELECT w.balance, w.debt FROM wallets w JOIN users u ON u.id = w.user_id
    WHERE u.email = ${`defi-${name.toLowerCase()}-${runId}@focus.test`}
  `
  return { balance: row!.balance as number, debt: row!.debt as number }
}

test('création avec mise, invitation, classement en direct, clôture et gains', async ({ browser }) => {
  const challengeName = `Semaine ${runId}`

  // Alice crée un défi de la semaine avec une mise de 20 crédits (solde de départ : 50)
  const alice = await browser.newContext({ timezoneId: E2E_TIMEZONE })
  const alicePage = await alice.newPage()
  await signUp(alicePage.request, 'Alice')
  await alicePage.goto('/app/defis')
  await alicePage.getByLabel('Nom du défi').fill(challengeName)
  await alicePage.getByLabel('Mesure').selectOption('completed_occurrences')
  await alicePage.getByLabel('Mise (optionnelle)').selectOption('20')
  await alicePage.getByRole('button', { name: 'Créer le défi' }).click()
  await expect(alicePage.getByRole('heading', { name: challengeName })).toBeVisible()
  const link = await alicePage.getByLabel('Lien d\'invitation').inputValue()
  expect(link).toMatch(/\/defis\/rejoindre\/[A-Za-z0-9_-]{43}$/)
  const challengeId = new URL(alicePage.url()).pathname.split('/').pop()!
  expect(await balanceOf('Alice')).toEqual({ balance: 30, debt: 0 })

  // Bob ouvre le lien, se connecte (compte créé via l'API) et rejoint en misant
  const bob = await browser.newContext({ timezoneId: E2E_TIMEZONE })
  const bobPage = await bob.newPage()
  await signUp(bobPage.request, 'Bob')
  await bobPage.goto(link)
  await expect(bobPage.getByRole('heading', { name: `Alice vous défie : « ${challengeName} »` })).toBeVisible()
  await bobPage.getByRole('button', { name: 'Rejoindre et miser 20 crédits' }).click()
  await expect(bobPage).toHaveURL(new RegExp(`/app/defis/${challengeId}$`))
  await expect(bobPage.getByTestId('challenge-pot')).toHaveText('40 crédits')
  expect(await balanceOf('Bob')).toEqual({ balance: 30, debt: 0 })

  // Rejoindre deux fois est refusé ; une mise sans solde suffisant aussi (jamais de dette)
  const token = new URL(link).pathname.split('/').pop()!
  const again = await bobPage.request.post(`/api/challenges/invitations/${token}/join`)
  expect(again.status()).toBe(409)
  const carol = await browser.newContext({ timezoneId: E2E_TIMEZONE })
  const carolPage = await carol.newPage()
  await signUp(carolPage.request, 'Carol')
  await sql`UPDATE wallets SET balance = 5 WHERE user_id = (SELECT id FROM users WHERE email = ${`defi-carol-${runId}@focus.test`})`
  const poor = await carolPage.request.post(`/api/challenges/invitations/${token}/join`)
  expect(poor.status()).toBe(400)
  expect((await poor.json()).data.code).toBe('insufficient_credits')
  expect(await balanceOf('Carol')).toEqual({ balance: 5, debt: 0 })

  // Alice valide une échéance : classement en direct, sans données privées
  const secret = `Objectif privé ${runId}`
  await expect(alicePage.request.post('/api/goals', {
    data: { type: 'recurring', title: secret, recurrenceType: 'daily', recurrenceConfig: { dueTime: '23:59' } },
  })).resolves.toBeOK()
  const { occurrences } = await (await alicePage.request.get('/api/occurrences?filter=today')).json()
  await expect(alicePage.request.post(`/api/occurrences/${occurrences[0].id}/complete`, { data: {} })).resolves.toBeOK()

  await bobPage.reload()
  const ranking = bobPage.getByTestId('challenge-ranking')
  await expect(ranking.getByRole('listitem').first()).toContainText('Alice')
  await expect(ranking.getByRole('listitem').first()).toContainText('1 validée')
  const raw = await (await bobPage.request.get(`/api/challenges/${challengeId}`)).text()
  for (const forbidden of [secret, 'email', 'balance', 'userId']) {
    expect(raw, `« ${forbidden} » ne doit pas être exposé`).not.toContain(forbidden)
  }

  // Clôture par le worker (horloge avancée après le lundi midi), deux fois : idempotente
  process.env.DATABASE_URL = E2E_DATABASE_URL
  process.env.REDIS_URL = E2E_REDIS_URL
  const { closeFinishedChallenges } = await import('../server/utils/challenges')
  const later = new Date(Date.now() + 9 * 86_400_000)
  await closeFinishedChallenges(later)
  await closeFinishedChallenges(later)

  const payouts = await sql`
    SELECT u.display_name AS name, l.amount FROM credit_ledger l JOIN users u ON u.id = l.user_id
    WHERE l.type = 'challenge_payout' AND l.metadata->>'challengeId' = ${challengeId}
  `
  expect(payouts.map(row => [row.name, row.amount])).toEqual([['Alice', 40]])
  const [notification] = await sql`
    SELECT n.message FROM notifications n JOIN users u ON u.id = n.user_id
    WHERE u.email = ${`defi-bob-${runId}@focus.test`} AND n.metadata->>'challengeId' = ${challengeId}
  `
  expect(notification?.message).toContain('vous finissez 2e')

  await alicePage.reload()
  await expect(alicePage.getByText('Podium final')).toBeVisible()
  await expect(alicePage.getByTestId('challenge-ranking').getByRole('listitem').first()).toContainText('+40')

  const { closeDatabase } = await import('../server/database')
  await closeDatabase()
})

test('quitter avant le début rembourse la mise', async ({ page }) => {
  await signUp(page.request, 'Dave')
  const created = await page.request.post('/api/challenges', {
    data: { name: `Prochaine ${runId}`, week: 'next', metric: 'perfect_days', stakeCredits: 10 },
  })
  await expect(created).toBeOK()
  const { id } = await created.json()
  expect(await balanceOf('Dave')).toEqual({ balance: 40, debt: 0 })

  await page.goto(`/app/defis/${id}`)
  await expect(page.getByText('À venir')).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Quitter le défi' }).click()
  await expect(page).toHaveURL(/\/app\/defis$/)
  expect(await balanceOf('Dave')).toEqual({ balance: 50, debt: 0 })

  const ledger = await sql`
    SELECT l.type::text AS type, l.amount FROM credit_ledger l JOIN users u ON u.id = l.user_id
    WHERE u.email = ${`defi-dave-${runId}@focus.test`} AND l.type::text LIKE 'challenge_%' ORDER BY l.created_at
  `
  expect(ledger.map(row => [row.type, row.amount])).toEqual([['challenge_stake', -10], ['challenge_refund', 10]])
})
