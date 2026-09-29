import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test, expect, type Page } from '@playwright/test'
import postgres from 'postgres'
import { E2E_DATABASE_URL, E2E_TIMEZONE } from './env'

// Profil public opt-in : privé par défaut, carte de partage sans aucune donnée financière,
// lien renouvelable et désactivable (l'ancien lien meurt tout de suite).
const runId = Date.now().toString(36)
const sql = postgres(E2E_DATABASE_URL, { max: 1, onnotice: () => {} })

test.afterAll(async () => {
  await sql.end()
})

async function publicLink(page: Page) {
  return page.getByLabel('Lien de votre profil').inputValue()
}

test('opt-in, carte publique sans données financières, puis lien renouvelé et désactivé', async ({ page, browser }) => {
  const email = `public-${runId}@focus.test`
  const name = `Zoé ${runId}`
  await expect(page.request.post('/api/auth/register', {
    data: { email, password: randomBytes(16).toString('base64url'), displayName: name },
  })).resolves.toBeOK()
  await expect(page.request.patch('/api/user/settings', {
    data: { displayName: name, timezone: E2E_TIMEZONE, leaderboardOptIn: false },
  })).resolves.toBeOK()

  // Série de 30 jours, record 42, et un portefeuille qui ne doit jamais apparaître
  const [user] = await sql`SELECT id FROM users WHERE email = ${email}`
  await sql`
    INSERT INTO user_streaks (user_id, current_streak, longest_streak) VALUES (${user!.id}, 30, 42)
    ON CONFLICT (user_id) DO UPDATE SET current_streak = 30, longest_streak = 42
  `
  await sql`UPDATE wallets SET balance = 4321, debt = 987 WHERE user_id = ${user!.id}`

  // Privé par défaut
  expect((await (await page.request.get('/api/auth/me')).json()).user.publicSlug).toBeNull()
  await page.goto('/app/reglages')
  const toggle = page.getByRole('switch', { name: 'Rendre mon profil public' })
  await expect(toggle).toHaveAttribute('aria-checked', 'false')

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  const firstLink = await publicLink(page)
  expect(firstLink).toMatch(new RegExp(`/u/zoe-${runId}-[a-z2-9]{8}$`))
  const firstPath = new URL(firstLink).pathname

  // L'API publique n'expose que nom, série et badges
  const api = await page.request.get(`/api/public${firstPath.replace('/u/', '/profiles/')}`)
  expect(api.headers()['cache-control']).toBe('no-store')
  const profile = await api.json()
  expect(Object.keys(profile).sort()).toEqual(['badges', 'currentStreak', 'displayName', 'longestStreak'])
  expect(profile).toMatchObject({ displayName: name, currentStreak: 30, longestStreak: 42 })

  // Visiteur non connecté, sur mobile
  const visitor = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const visitorPage = await visitor.newPage()
  await visitorPage.goto(firstPath)
  const card = visitorPage.getByTestId('share-card')
  await expect(card.getByRole('heading', { name: '30 jours de Focus' })).toBeVisible()
  await expect(card.getByText('Record : 42 jours')).toBeVisible()
  await expect(card.getByLabel('Palier de 30 jours atteint')).toBeVisible()
  await expect(card.getByLabel('Palier de 100 jours pas encore atteint')).toBeVisible()
  await expect(visitorPage.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  await expect(visitorPage).toHaveTitle(`${name} · 30 jours de Focus`)
  const body = await visitorPage.locator('body').innerText()
  for (const forbidden of ['4321', '987', 'crédit', '€', email]) expect(body).not.toContain(forbidden)
  expect(await visitorPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect(visitorPage.getByRole('link', { name: 'Créer mon compte Focus' })).toBeVisible()
  await visitor.close()

  // Desktop : image PNG téléchargeable
  await page.goto(firstPath)
  await expect(page.getByRole('link', { name: 'Gérer mon profil public' })).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Télécharger l\'image' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe(`focus-${firstPath.split('/').pop()}.png`)
  const png = await readFile((await download.path())!)
  expect(png.subarray(1, 4).toString()).toBe('PNG')
  expect(png.length).toBeGreaterThan(10_000)

  // Nouveau lien : l'ancien ne fonctionne plus
  await page.goto('/app/reglages')
  await page.getByRole('button', { name: 'Changer de lien' }).click()
  await expect.poll(() => publicLink(page)).not.toBe(firstLink)
  const secondPath = new URL(await publicLink(page)).pathname
  const dead = await page.goto(firstPath)
  expect(dead?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Profil introuvable' })).toBeVisible()
  expect((await page.goto(secondPath))?.status()).toBe(200)

  // Désactivation : lien mort, retour au privé
  await page.goto('/app/reglages')
  await page.getByRole('switch', { name: 'Rendre mon profil public' }).click()
  await expect(page.getByRole('switch', { name: 'Rendre mon profil public' })).toHaveAttribute('aria-checked', 'false')
  expect((await page.request.get(`/api/public${secondPath.replace('/u/', '/profiles/')}`)).status()).toBe(404)
  expect((await (await page.request.get('/api/auth/me')).json()).user.publicSlug).toBeNull()
  const [audit] = await sql`
    SELECT count(*)::int AS n FROM audit_logs WHERE entity_id = ${user!.id} AND action LIKE 'user.public_profile_%'
  `
  expect(audit!.n).toBe(3)
})
