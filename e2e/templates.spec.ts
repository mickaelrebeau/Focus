import { randomBytes } from 'node:crypto'
import { test, expect, type Page } from '@playwright/test'
import { E2E_TIMEZONE } from './env'

// Modèles d'objectifs et packs d'habitudes (catalogue shared/goal-templates.json)
const runId = Date.now().toString(36)

async function signUpAndOnboard(page: Page, name: string) {
  await expect(page.request.post('/api/auth/register', {
    data: { email: `${name}-${runId}@focus.test`, password: randomBytes(16).toString('base64url'), displayName: 'Modèles' },
  })).resolves.toBeOK()
  await expect(page.request.patch('/api/user/settings', {
    data: { displayName: 'Modèles', timezone: E2E_TIMEZONE, leaderboardOptIn: false },
  })).resolves.toBeOK()
}

async function goals(page: Page) {
  const { goals } = await (await page.request.get('/api/goals')).json()
  return goals as Array<{ title: string, category: string, recurrenceType: string, recurrenceConfig: { dueTime: string, daysOfWeek?: number[] } }>
}

test('un modèle préremplit le formulaire, modifiable avant création', async ({ page }) => {
  await signUpAndOnboard(page, 'modele')
  await page.goto('/app/objectifs/nouveau')
  await expect(page.getByRole('heading', { name: 'Démarrer avec un modèle' })).toBeVisible()

  await page.locator('[data-template="lire-20-pages"]').click()
  await expect(page.getByText('Prérempli depuis le modèle « Lire 20 pages »')).toBeVisible()
  await expect(page.getByText('Conséquence suggérée : perte de 10 crédits.')).toBeVisible()
  await expect(page.getByLabel('Titre')).toHaveValue('Lire 20 pages')
  await expect(page.getByLabel('Catégorie')).toHaveValue('Lecture')
  await expect(page.getByLabel('Heure limite')).toHaveValue('23:00')

  const title = `Lire 30 pages ${runId}`
  await page.getByLabel('Titre').fill(title)
  await page.getByRole('button', { name: 'Créer l\'objectif' }).click()
  await expect(page).toHaveURL(/\/app\/objectifs$/)

  const created = (await goals(page)).find(goal => goal.title === title)
  expect(created).toMatchObject({ category: 'Lecture', recurrenceType: 'daily', recurrenceConfig: { dueTime: '23:00' } })
})

test('lien direct vers un modèle et création d’un pack', async ({ page }) => {
  await signUpAndOnboard(page, 'pack')

  await page.goto('/app/objectifs/nouveau?template=post-linkedin')
  await expect(page.getByLabel('Titre')).toHaveValue('Publier sur LinkedIn')
  await expect(page.getByLabel('Heure limite')).toHaveValue('12:00')

  await page.goto('/app/objectifs/nouveau')
  await page.locator('.app-sheet').filter({ hasText: 'Sport, méditation et un meilleur sommeil.' })
    .getByRole('button', { name: 'Ajouter les 3 objectifs' }).click()
  await expect(page).toHaveURL(/\/app\/objectifs$/)
  const titles = (await goals(page)).map(goal => goal.title).sort()
  expect(titles).toEqual(['Couper les écrans à 22 h', 'Faire du sport', 'Méditer 10 minutes'])
})

test('l’onboarding propose de démarrer avec un modèle', async ({ page }) => {
  await page.goto('/inscription')
  await page.getByPlaceholder('Votre prénom').fill('Nouveau')
  await page.getByPlaceholder('vous@email.com').fill(`onboarding-${runId}@focus.test`)
  await page.getByPlaceholder('8 caractères minimum').fill(randomBytes(16).toString('base64url'))
  await page.getByRole('button', { name: 'S\'inscrire' }).click()
  await expect(page).toHaveURL(/\/app\/onboarding$/)

  await page.getByRole('button', { name: 'Continuer et choisir un modèle' }).click()
  await expect(page).toHaveURL(/\/app\/objectifs\/nouveau$/)
  await expect(page.getByRole('heading', { name: 'Démarrer avec un modèle' })).toBeVisible()
})
