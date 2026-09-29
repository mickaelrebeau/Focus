import { randomBytes } from 'node:crypto'
import { test, expect, type APIRequestContext } from '@playwright/test'
import postgres from 'postgres'
import { E2E_DATABASE_URL, E2E_TIMEZONE } from './env'

// RGPD : export JSON sans secrets, suppression confirmée et irréversible, purge sans casse
// pour les autres utilisateurs (défi créé par le compte supprimé).
const runId = Date.now().toString(36)
const sql = postgres(E2E_DATABASE_URL, { max: 1, onnotice: () => {} })

test.afterAll(async () => {
  await sql.end()
})

async function signUp(request: APIRequestContext, name: string) {
  const email = `rgpd-${name.toLowerCase()}-${runId}@focus.test`
  const password = randomBytes(16).toString('base64url')
  await expect(request.post('/api/auth/register', { data: { email, password, displayName: name } })).resolves.toBeOK()
  await expect(request.patch('/api/user/settings', {
    data: { displayName: name, timezone: E2E_TIMEZONE, leaderboardOptIn: true },
  })).resolves.toBeOK()
  return { email, password }
}

function collectKeys(value: unknown, keys = new Set<string>()) {
  if (Array.isArray(value)) value.forEach(item => collectKeys(item, keys))
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      keys.add(key)
      collectKeys(item, keys)
    }
  }
  return keys
}

test('export sans secrets, puis suppression du compte et purge', async ({ browser }) => {
  const alice = await browser.newContext({ timezoneId: E2E_TIMEZONE })
  const page = await alice.newPage()
  const { email, password } = await signUp(page.request, 'Alice')
  const goalTitle = `Méditer ${runId}`
  await expect(page.request.post('/api/goals', {
    data: { type: 'recurring', title: goalTitle, recurrenceType: 'daily', recurrenceConfig: { dueTime: '23:59' } },
  })).resolves.toBeOK()

  // Défi de la semaine prochaine créé par Alice, rejoint par Bob
  const created = await page.request.post('/api/challenges', {
    data: { name: `Défi ${runId}`, week: 'next', metric: 'completed_occurrences', stakeCredits: 10 },
  })
  await expect(created).toBeOK()
  const { id: challengeId, token } = await created.json()
  const bob = await browser.newContext({ timezoneId: E2E_TIMEZONE })
  const bobPage = await bob.newPage()
  await signUp(bobPage.request, 'Bob')
  await expect(bobPage.request.post(`/api/challenges/invitations/${token}/join`)).resolves.toBeOK()

  // Export : téléchargement depuis les réglages
  await page.goto('/app/reglages')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Télécharger l\'export' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^focus-export-\d{4}-\d{2}-\d{2}\.json$/)

  const response = await page.request.get('/api/user/export')
  await expect(response).toBeOK()
  expect(response.headers()['content-disposition']).toContain('attachment')
  const raw = await response.text()
  const data = JSON.parse(raw)
  expect(data.format).toBe('focus-account-export')
  expect(data.profile.email).toBe(email)
  expect(data.profile.loginMethods).toEqual(['password'])
  expect(data.goals.map((goal: { title: string }) => goal.title)).toContain(goalTitle)
  expect(data.occurrences.length).toBeGreaterThan(0)
  expect(data.creditLedger.some((entry: { type: string }) => entry.type === 'challenge_stake')).toBe(true)
  expect(data.challenges).toEqual([expect.objectContaining({ name: `Défi ${runId}`, isCreator: true, stakePaid: 10 })])
  expect(data.sessions.length).toBeGreaterThan(0)

  const keys = [...collectKeys(data)]
  expect(keys.filter(key => /password|hash|token|secret|p256dh|^auth$|stripe|google/i.test(key.replace(/[_-]/g, '')))).toEqual([])
  expect(raw).not.toContain(password)
  const [session] = await sql`SELECT token FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email = ${email} LIMIT 1`
  expect(raw).not.toContain(session!.token)

  // Confirmation : mauvais email ou mauvais mot de passe refusés
  const wrongEmail = await page.request.post('/api/user/delete-account', { data: { confirmEmail: 'autre@focus.test', password } })
  expect(wrongEmail.status()).toBe(400)
  const wrongPassword = await page.request.post('/api/user/delete-account', { data: { confirmEmail: email, password: 'mauvais-mot-de-passe' } })
  expect(wrongPassword.status()).toBe(400)

  // Suppression depuis les réglages : le bouton final n'est actif qu'une fois l'email et le mot de passe saisis
  await page.getByRole('button', { name: 'Supprimer mon compte…' }).click()
  const confirm = page.getByRole('button', { name: 'Supprimer définitivement' })
  await expect(confirm).toBeDisabled()
  await page.getByLabel(`Saisissez votre email (${email}) pour confirmer`).fill(email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  await confirm.click()
  await expect(page).toHaveURL(/\/connexion\?compte=supprime$/)
  await expect(page.getByRole('status').filter({ hasText: 'Votre compte a été supprimé.' })).toBeVisible()

  // Compte inaccessible : plus de session, connexion refusée
  expect((await page.request.get('/api/auth/me')).status()).toBe(401)
  const login = await page.request.post('/api/auth/login', { data: { email, password } })
  expect(login.status()).toBe(403)
  expect((await login.json()).message).toBe('Ce compte a été supprimé')

  // Plus rien ne peut échouer ni coûter : échéances en pause, objectif inactif, mise remboursée
  const [user] = await sql`
    SELECT u.id, u.deleted_at, u.is_blocked, u.leaderboard_opt_in, w.balance
    FROM users u JOIN wallets w ON w.user_id = u.id WHERE u.email = ${email}
  `
  expect(user!.deleted_at).not.toBeNull()
  expect(user!.is_blocked).toBe(true)
  expect(user!.leaderboard_opt_in).toBe(false)
  expect(user!.balance).toBe(50)
  const [counts] = await sql`
    SELECT
      (SELECT count(*)::int FROM sessions WHERE user_id = ${user!.id}) AS sessions,
      (SELECT count(*)::int FROM occurrences WHERE user_id = ${user!.id} AND status = 'pending') AS pending,
      (SELECT count(*)::int FROM goals WHERE user_id = ${user!.id} AND is_active) AS active_goals
  `
  expect(counts).toEqual({ sessions: 0, pending: 0, active_goals: 0 })

  // Purge (requête du worker) : le défi survit pour Bob, sans organisateur
  await sql`DELETE FROM users WHERE id = ${user!.id} AND deleted_at IS NOT NULL`
  const [challenge] = await sql`SELECT creator_id FROM challenges WHERE id = ${challengeId}`
  expect(challenge).toEqual({ creator_id: null })
  const participants = await sql`SELECT user_id FROM challenge_participants WHERE challenge_id = ${challengeId}`
  expect(participants).toHaveLength(1)
  await expect(bobPage.request.get(`/api/challenges/invitations/${token}`)).resolves.toBeOK()

  await alice.close()
  await bob.close()
})
