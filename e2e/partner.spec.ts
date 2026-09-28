import { randomBytes } from 'node:crypto'
import { test, expect, type APIRequestContext } from '@playwright/test'
import { E2E_TIMEZONE } from './env'

// Binôme de responsabilité : invitation par lien, vue mutuelle minimale, révocation.
const runId = Date.now().toString(36)
const secretGoal = `Objectif secret ${runId}`

async function signUp(request: APIRequestContext, name: string) {
  await expect(request.post('/api/auth/register', {
    data: { email: `${name.toLowerCase()}-${runId}@focus.test`, password: randomBytes(16).toString('base64url'), displayName: name },
  })).resolves.toBeOK()
  await expect(request.patch('/api/user/settings', {
    data: { displayName: name, timezone: E2E_TIMEZONE, leaderboardOptIn: false },
  })).resolves.toBeOK()
}

test('invitation, vue mutuelle sans données privées, puis révocation', async ({ browser }) => {
  // Alice : un objectif du jour validé
  const alice = await browser.newContext({ timezoneId: E2E_TIMEZONE })
  const alicePage = await alice.newPage()
  await signUp(alicePage.request, 'Alice')
  await expect(alicePage.request.post('/api/goals', {
    data: { type: 'recurring', title: secretGoal, recurrenceType: 'daily', recurrenceConfig: { dueTime: '23:59' } },
  })).resolves.toBeOK()
  const { occurrences } = await (await alicePage.request.get('/api/occurrences?filter=today')).json()
  await expect(alicePage.request.post(`/api/occurrences/${occurrences[0].id}/complete`, { data: { note: 'note privée' } })).resolves.toBeOK()

  await alicePage.goto('/app/binome')
  await alicePage.getByRole('button', { name: 'Créer un lien d\'invitation' }).click()
  const link = await alicePage.getByLabel('Lien d\'invitation').inputValue()
  expect(link).toMatch(/\/binome\/[A-Za-z0-9_-]{43}$/)

  // Bob, non connecté, ouvre le lien puis crée son compte : retour sur l'invitation
  const bob = await browser.newContext({ timezoneId: E2E_TIMEZONE })
  const bobPage = await bob.newPage()
  await bobPage.goto(link)
  await expect(bobPage.getByRole('heading', { name: 'Alice vous invite à devenir son binôme' })).toBeVisible()
  await bobPage.getByRole('link', { name: 'Créer un compte' }).click()
  await bobPage.getByPlaceholder('Votre prénom').fill('Bob')
  await bobPage.getByPlaceholder('vous@email.com').fill(`bob-${runId}@focus.test`)
  await bobPage.getByPlaceholder('8 caractères minimum').fill(randomBytes(16).toString('base64url'))
  await bobPage.getByRole('button', { name: 'S\'inscrire' }).click()
  await expect(bobPage).toHaveURL(/\/app\/onboarding\?redirect=/)
  await bobPage.getByRole('button', { name: 'Continuer' }).click()
  await expect(bobPage).toHaveURL(new URL(link).pathname)

  await bobPage.getByRole('button', { name: 'Accepter et partager mon statut' }).click()
  await expect(bobPage).toHaveURL(/\/app\/binome$/)
  await expect(bobPage.getByText('Alice', { exact: true })).toBeVisible()
  const aliceToday = bobPage.getByTestId('partner-today')
  await expect(aliceToday.getByText('Journée réussie')).toBeVisible()
  await expect(aliceToday.getByText('1 sur 1 échéances validées')).toBeVisible()

  // Confidentialité : ni titre d'objectif, ni note, ni crédits, ni conséquences
  const raw = await (await bobPage.request.get('/api/partnerships')).text()
  for (const forbidden of [secretGoal, 'note privée', 'credits', 'balance', 'debt', 'wallet', 'consequence', 'amount', 'email']) {
    expect(raw, `« ${forbidden} » ne doit pas être exposé`).not.toContain(forbidden)
  }

  // Vue mutuelle : Alice voit Bob
  await alicePage.reload()
  await expect(alicePage.getByText('Bob', { exact: true })).toBeVisible()
  await expect(alicePage.getByTestId('partner-today').getByText('Rien de prévu')).toBeVisible()

  // Lien à usage unique, et un seul binôme à la fois
  const reuse = await bobPage.request.post(`/api/partnerships/invitations/${link.split('/').pop()}/accept`)
  expect(reuse.status()).toBe(404)
  expect((await bobPage.request.post('/api/partnerships/invitations')).status()).toBe(409)

  // Révocation par Bob, à tout moment
  bobPage.once('dialog', dialog => dialog.accept())
  await bobPage.getByRole('button', { name: 'Mettre fin au binôme' }).click()
  await expect(bobPage.getByRole('status').getByText('Binôme terminé.')).toBeVisible()
  await alicePage.reload()
  await expect(alicePage.getByRole('button', { name: 'Créer un lien d\'invitation' })).toBeVisible()

  await alice.close()
  await bob.close()
})
