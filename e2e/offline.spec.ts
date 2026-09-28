import { randomBytes } from 'node:crypto'
import { test, expect, type Page } from '@playwright/test'

// Mode hors ligne : nécessite le service worker, bloqué par défaut dans playwright.config.ts
test.use({ serviceWorkers: 'allow' })

const runId = Date.now().toString(36)
const goalTitle = `Méditer ${runId}`

function occurrenceCard(page: Page, title: string) {
  return page.locator('.app-row').filter({ has: page.getByRole('heading', { name: title }) })
}

async function offlineCacheNames(page: Page) {
  return page.evaluate(async () => (await caches.keys()).filter(name => name.startsWith('focus-')).sort())
}

test('échéances du jour consultables hors ligne, sans corruption à la reconnexion', async ({ page, context }) => {
  // Compte, onboarding et objectif créés via l'API (le parcours UI est couvert ailleurs)
  const request = page.request
  const email = `offline-${runId}@focus.test`
  // Généré à chaque exécution : aucun identifiant versionné
  const password = randomBytes(16).toString('base64url')
  await expect(request.post('/api/auth/register', {
    data: { email, password, displayName: 'Hors ligne' },
  })).resolves.toBeOK()
  await expect(request.patch('/api/user/settings', {
    data: { displayName: 'Hors ligne', timezone: 'Europe/Paris', leaderboardOptIn: false },
  })).resolves.toBeOK()
  await expect(request.post('/api/goals', {
    data: { type: 'recurring', title: goalTitle, recurrenceType: 'daily', recurrenceConfig: { dueTime: '23:59' } },
  })).resolves.toBeOK()

  // Première visite : installation du service worker, puis rechargement sous son contrôle
  await page.goto('/app')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await expect(occurrenceCard(page, goalTitle)).toBeVisible()
  await page.goto('/app/agenda')
  await expect(occurrenceCard(page, goalTitle)).toBeVisible()
  expect(await offlineCacheNames(page)).toEqual(['focus-api', 'focus-pages'])

  await context.setOffline(true)

  // Rechargement complet hors ligne : données en cache, utilisateur toujours connecté
  await page.goto('/app')
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByRole('status').getByText('Hors ligne.')).toBeVisible()
  const card = occurrenceCard(page, goalTitle)
  await expect(card.getByText('À faire')).toBeVisible()

  // Validation impossible hors ligne, avec un message clair
  await card.getByRole('button', { name: `Valider ${goalTitle}` }).click()
  const modal = page.getByRole('dialog', { name: 'Valider l\'échéance' })
  await expect(modal.getByText('Hors ligne : la validation sera possible au retour du réseau.')).toBeVisible()
  await expect(modal.getByRole('button', { name: /^Valider \(\+\d+\)$/ })).toBeDisabled()
  await modal.getByRole('button', { name: 'Annuler' }).click()

  // Page jamais consultée : page hors ligne précachée
  await page.goto('/app/historique')
  await expect(page.getByRole('heading', { name: 'Vous êtes hors ligne' })).toBeVisible()

  // Reconnexion : l'app redevient pleinement utilisable
  await context.setOffline(false)
  await page.goto('/app')
  await expect(page.getByRole('status').getByText('Hors ligne.')).toBeHidden()
  await card.getByRole('button', { name: `Valider ${goalTitle}` }).click()
  await modal.getByRole('button', { name: /^Valider \(\+\d+\)$/ }).click()
  await expect(modal).toBeHidden()
  await expect(card.getByText('Réussi')).toBeVisible()

  // Déconnexion : les caches contenant des données personnelles sont vidés
  await page.goto('/app/reglages')
  await page.getByRole('button', { name: 'Déconnexion' }).click()
  await expect(page).toHaveURL(/\/connexion$/)
  expect(await offlineCacheNames(page)).toEqual([])
})
