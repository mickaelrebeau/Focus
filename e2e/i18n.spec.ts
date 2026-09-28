import { randomBytes } from 'node:crypto'
import { test, expect } from '@playwright/test'

test('le français est la langue par défaut, même pour un navigateur anglophone', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US' })
  const page = await context.newPage()

  await page.goto('/connexion')
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR')

  await context.close()
})

test('le choix de la langue est appliqué tout de suite et conservé au rechargement', async ({ page }) => {
  await page.goto('/connexion')
  const switcher = page.getByRole('group', { name: 'Langue' })

  await switcher.getByRole('button', { name: 'en' }).click()
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  await expect(page.getByPlaceholder('you@email.com')).toBeVisible()

  // Rendu serveur dans la langue choisie (cookie), sans passage par le français
  const response = await page.reload()
  expect(await response?.text()).toContain('Log in')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
  await expect(page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'en' })).toHaveAttribute('aria-pressed', 'true')

  // Erreur d'authentification traduite à partir du code HTTP
  await page.getByPlaceholder('you@email.com').fill(`inconnu-${Date.now()}@focus.test`)
  await page.getByPlaceholder('••••••••').fill(randomBytes(12).toString('hex'))
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByText('Incorrect email or password')).toBeVisible()

  await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'fr' }).click()
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible()
})

test('agenda et conséquences en anglais', async ({ page, context, baseURL }) => {
  const runId = Date.now().toString(36)
  const title = `Stretch ${runId}`
  // Mot de passe généré, aucun identifiant versionné
  const password = randomBytes(16).toString('base64url')
  await expect(page.request.post('/api/auth/register', {
    data: { email: `i18n-${runId}@focus.test`, password, displayName: 'I18n' },
  })).resolves.toBeOK()
  await expect(page.request.patch('/api/user/settings', {
    data: { displayName: 'I18n', timezone: 'Europe/Paris', leaderboardOptIn: false },
  })).resolves.toBeOK()
  await expect(page.request.post('/api/goals', {
    data: { type: 'recurring', title, recurrenceType: 'daily', recurrenceConfig: { dueTime: '23:59' } },
  })).resolves.toBeOK()
  await context.addCookies([{ name: 'focus_locale', value: 'en', url: baseURL! }])

  await page.goto('/app/agenda')
  await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible()
  await expect(page.getByText('Mon', { exact: true })).toBeVisible()
  const card = page.locator('.app-row').filter({ has: page.getByRole('heading', { name: title }) })
  await expect(card.getByText('To do')).toBeVisible()
  await expect(card.getByRole('button', { name: `Check in ${title}` })).toBeVisible()

  // Conséquence « crédits » créée par défaut à l'inscription
  await page.goto('/app/reglages/consequences')
  await expect(page.getByRole('heading', { name: 'Consequences', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Credit loss' })).toBeVisible()
  await expect(page.getByText(/^-\d+ credits$/)).toBeVisible()
})
