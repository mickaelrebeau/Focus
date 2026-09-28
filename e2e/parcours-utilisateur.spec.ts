import { randomBytes } from 'node:crypto'
import { test, expect, type Page } from '@playwright/test'
import postgres from 'postgres'
import { E2E_DATABASE_URL, E2E_TIMEZONE } from './env'

// Parcours critique : inscription → objectif → validation → agenda (réussi / échoué) → connexion.
// Les étapes partagent le même compte et s'enchaînent dans l'ordre.
test.describe.configure({ mode: 'serial' })

const runId = Date.now().toString(36)
const account = {
  displayName: `E2E ${runId}`,
  email: `e2e-${runId}@focus.test`,
  // Généré à chaque exécution : aucun identifiant versionné
  password: `E2e-${randomBytes(12).toString('hex')}`,
}
const dailyGoal = `Lire 10 pages ${runId}`
const oneTimeGoal = `Envoyer le rapport ${runId}`

const sql = postgres(E2E_DATABASE_URL, { max: 1, onnotice: () => {} })

test.afterAll(async () => {
  await sql.end()
})

function todayInTimezone() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: E2E_TIMEZONE }).format(new Date())
}

function occurrenceCard(page: Page, goalTitle: string) {
  return page.locator('.app-row').filter({ has: page.getByRole('heading', { name: goalTitle }) })
}

async function createGoal(page: Page, type: 'Récurrent' | 'Ponctuel', title: string, dueDate?: string) {
  await page.goto('/app/objectifs/nouveau')
  await page.getByRole('button', { name: new RegExp(`^${type}`) }).click()
  await page.getByLabel('Titre').fill(title)
  if (dueDate) {
    await page.getByLabel('Date limite').fill(dueDate)
  }
  await page.getByRole('button', { name: 'Créer l\'objectif' }).click()
  await expect(page).toHaveURL(/\/app\/objectifs$/)
  await expect(page.getByText(title)).toBeVisible()
}

test('inscription puis onboarding', async ({ page }) => {
  await page.goto('/inscription')
  await page.getByPlaceholder('Votre prénom').fill(account.displayName)
  await page.getByPlaceholder('vous@email.com').fill(account.email)
  await page.getByPlaceholder('8 caractères minimum').fill(account.password)
  await page.getByRole('button', { name: 'S\'inscrire' }).click()

  await expect(page).toHaveURL(/\/app\/onboarding$/)
  await expect(page.getByLabel('Nom d\'affichage')).toHaveValue(account.displayName)
  await page.getByRole('button', { name: 'Continuer' }).click()

  await expect(page).toHaveURL(/\/app$/)
})

test.describe('avec un compte connecté', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/connexion')
    await page.getByPlaceholder('vous@email.com').fill(account.email)
    await page.getByPlaceholder('••••••••').fill(account.password)
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await expect(page).toHaveURL(/\/app$/)
  })

  test('création d’un objectif quotidien : l’échéance du jour apparaît', async ({ page }) => {
    await createGoal(page, 'Récurrent', dailyGoal)

    await page.goto('/app')
    const card = occurrenceCard(page, dailyGoal)
    await expect(card).toBeVisible()
    await expect(card.getByText('À faire')).toBeVisible()
  })

  test('validation de l’échéance', async ({ page }) => {
    const card = occurrenceCard(page, dailyGoal)
    await card.getByRole('button', { name: `Valider ${dailyGoal}` }).click()

    const modal = page.getByRole('dialog', { name: 'Valider l\'échéance' })
    await expect(modal).toBeVisible()
    await modal.getByRole('button', { name: /^Valider \(\+\d+\)$/ }).click()
    await expect(modal).toBeHidden()

    await expect(card.getByText('Réussi')).toBeVisible()
  })

  test('agenda : échéance réussie et échéance expirée passée en échec', async ({ page }) => {
    await createGoal(page, 'Ponctuel', oneTimeGoal, todayInTimezone())

    // Simule le dépassement de l'heure limite : la prochaine lecture API
    // (syncUserDeadlines) doit passer l'échéance en « Échoué ».
    const updated = await sql`
      UPDATE occurrences o
      SET due_at = now() - interval '1 minute'
      FROM goals g
      WHERE o.goal_id = g.id AND g.title = ${oneTimeGoal} AND o.status = 'pending'
      RETURNING o.id
    `
    expect(updated).toHaveLength(1)

    await page.goto('/app/agenda')
    // Jours de la semaine en français, avec majuscule (formatés par date-fns selon la langue)
    await expect(page.getByText('Lun', { exact: true })).toBeVisible()
    await expect(occurrenceCard(page, dailyGoal).getByText('Réussi')).toBeVisible()
    await expect(occurrenceCard(page, oneTimeGoal).getByText('Échoué')).toBeVisible()

    const [occurrence] = await sql`
      SELECT o.status FROM occurrences o JOIN goals g ON g.id = o.goal_id WHERE g.title = ${oneTimeGoal}
    `
    expect(occurrence?.status).toBe('failed')
  })
})
