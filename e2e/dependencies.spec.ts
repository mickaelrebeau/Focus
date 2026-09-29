import { randomBytes } from 'node:crypto'
import { test, expect, type Page } from '@playwright/test'
import postgres from 'postgres'
import { E2E_DATABASE_URL, E2E_TIMEZONE } from './env'

// Dépendances : chaîne de jalons stricte (déblocage, blocage après échec, déblocage manuel),
// objectif « débloqué après » un autre, refus des récurrents et des cycles, mode indicatif.
const runId = Date.now().toString(36)
const sql = postgres(E2E_DATABASE_URL, { max: 1, onnotice: () => {} })

test.afterAll(async () => {
  await sql.end()
})

function localDate(offsetDays = 0) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: E2E_TIMEZONE }).format(new Date(Date.now() + offsetDays * 86_400_000))
}

async function signUp(page: Page, name: string) {
  await expect(page.request.post('/api/auth/register', {
    data: { email: `dep-${name}-${runId}@focus.test`, password: randomBytes(16).toString('base64url'), displayName: name },
  })).resolves.toBeOK()
  await expect(page.request.patch('/api/user/settings', {
    data: { displayName: name, timezone: E2E_TIMEZONE, leaderboardOptIn: false },
  })).resolves.toBeOK()
}

async function createGoal(page: Page, data: Record<string, unknown>) {
  const response = await page.request.post('/api/goals', { data })
  await expect(response).toBeOK()
  return (await response.json()).goal as { id: string, milestones: Array<{ id: string, orderIndex: number }> }
}

async function occurrencesOf(goalId: string) {
  return sql`
    SELECT o.id, o.status::text AS status, o.due_date::text AS due_date, m.order_index
    FROM occurrences o LEFT JOIN project_milestones m ON m.id = o.milestone_id
    WHERE o.goal_id = ${goalId} ORDER BY m.order_index NULLS FIRST, o.due_date
  `
}

test('chaîne de jalons stricte : déblocage, blocage après un échec, puis déblocage manuel', async ({ page }) => {
  await signUp(page, 'chaine')
  const title = `Lancer le site ${runId}`

  // Création depuis l'interface : jalons dans l'ordre, verrouillage strict (par défaut)
  await page.goto('/app/objectifs/nouveau')
  await page.getByRole('button', { name: /Projet/ }).click()
  await page.getByLabel('Titre').fill(title)
  const steps = ['Maquette', 'Développement', 'Mise en ligne']
  for (const [index, step] of steps.entries()) {
    if (index > 0) await page.getByRole('button', { name: '+ Ajouter un jalon' }).click()
    await page.getByLabel(`Jalon ${index + 1}`).fill(step)
    await page.getByLabel('Date').nth(index).fill(localDate(index * 2))
  }
  await expect(page.getByLabel(/Jalons dans l'ordre/)).toBeChecked()
  await expect(page.getByLabel(/Strict/)).toBeChecked()
  await page.getByRole('button', { name: 'Créer l\'objectif' }).click()
  await expect(page).toHaveURL(/\/app\/objectifs$/)

  const [goal] = await sql`SELECT id FROM goals WHERE title = ${title}`
  // Seul le premier jalon a une échéance : les suivants ne peuvent ni être faits ni échouer
  expect((await occurrencesOf(goal!.id)).map(row => row.order_index)).toEqual([0])

  await page.goto(`/app/objectifs/${goal!.id}`)
  await expect(page.getByTestId('milestone-2')).toContainText('Verrouillé')
  await expect(page.getByTestId('milestone-2')).toContainText('Après la réussite de l\'étape 1.')

  // Réussite du jalon 1 : le jalon 2 est généré tout de suite
  const [first] = await occurrencesOf(goal!.id)
  await expect(page.request.post(`/api/occurrences/${first!.id}/complete`, { data: {} })).resolves.toBeOK()
  expect((await occurrencesOf(goal!.id)).map(row => row.order_index)).toEqual([0, 1])
  await page.reload()
  await expect(page.getByTestId('milestone-2')).not.toContainText('Verrouillé')
  await expect(page.getByTestId('milestone-3')).toContainText('Verrouillé')

  // Échec du jalon 2 : le jalon 3 est bloqué (pas verrouillé à vie), avec un déblocage manuel
  const second = (await occurrencesOf(goal!.id)).find(row => row.order_index === 1)!
  await sql`UPDATE occurrences SET due_at = now() - interval '1 minute' WHERE id = ${second.id}`
  await expect(page.request.get('/api/occurrences')).resolves.toBeOK()
  await page.reload()
  await expect(page.getByTestId('milestone-3')).toContainText('Bloqué')
  await expect(page.getByTestId('milestone-3')).toContainText('L\'étape 2 a échoué.')
  expect(await occurrencesOf(goal!.id)).toHaveLength(2)

  await page.getByTestId('milestone-3').getByRole('button', { name: 'Débloquer quand même' }).click()
  await expect(page.getByTestId('milestone-3')).not.toContainText('Bloqué')
  const rows = await occurrencesOf(goal!.id)
  expect(rows.map(row => [row.order_index, row.status])).toEqual([[0, 'completed'], [1, 'failed'], [2, 'pending']])
  expect(rows[2]!.due_date).toBe(localDate(4))
  const [audit] = await sql`SELECT count(*)::int AS n FROM audit_logs WHERE action = 'milestone.unlock' AND details->>'goalId' = ${goal!.id}`
  expect(audit!.n).toBe(1)
})

test('objectif débloqué après un autre : récurrents et cycles refusés, date ramenée au déblocage', async ({ page }) => {
  await signUp(page, 'objectifs')
  const recurring = await createGoal(page, { type: 'recurring', title: `Lire ${runId}`, recurrenceType: 'daily', recurrenceConfig: { dueTime: '23:59' } })
  const prerequisite = await createGoal(page, { type: 'one_time', title: `Acheter le livre ${runId}`, dueDate: localDate(), dueTime: '23:59' })

  // Un récurrent ne peut pas être un prérequis (il n'est jamais terminé)
  const refused = await page.request.post('/api/goals', {
    data: { type: 'one_time', title: `X ${runId}`, dueDate: localDate(), dependsOnGoalId: recurring.id },
  })
  expect(refused.status()).toBe(400)
  expect((await refused.json()).data.code).toBe('recurring_prerequisite')

  // Récurrent strict après le ponctuel : aucune échéance tant que le livre n'est pas acheté
  const reading = await createGoal(page, {
    type: 'recurring', title: `Lire chaque soir ${runId}`, recurrenceType: 'daily', recurrenceConfig: { dueTime: '23:59' },
    dependsOnGoalId: prerequisite.id, dependencyMode: 'hard',
  })
  expect(await occurrencesOf(reading.id)).toHaveLength(0)
  // Ponctuel dont la date est passée pendant le verrouillage
  const late = await createGoal(page, {
    type: 'one_time', title: `Écrire l'avis ${runId}`, dueDate: localDate(-3), dueTime: '23:59',
    dependsOnGoalId: prerequisite.id, dependencyMode: 'hard',
  })
  expect(await occurrencesOf(late.id)).toHaveLength(0)

  // Cycle refusé : le prérequis ne peut pas dépendre de ce qui dépend de lui
  const cycle = await page.request.patch(`/api/goals/${prerequisite.id}`, { data: { dependsOnGoalId: late.id } })
  expect(cycle.status()).toBe(400)
  expect((await cycle.json()).data.code).toBe('cycle')

  await page.goto(`/app/objectifs/${reading.id}`)
  await expect(page.getByTestId('goal-dependency')).toContainText(`Verrouillé jusqu'à la réussite de « Acheter le livre ${runId} »`)
  await page.goto('/app/objectifs')
  await expect(page.locator('.app-row').filter({ hasText: `Lire chaque soir ${runId}` })).toContainText('Verrouillé')

  // Réussite du prérequis : tout se débloque, la date passée est ramenée à aujourd'hui
  const [purchase] = await occurrencesOf(prerequisite.id)
  await expect(page.request.post(`/api/occurrences/${purchase!.id}/complete`, { data: {} })).resolves.toBeOK()
  expect((await occurrencesOf(reading.id))[0]!.due_date).toBe(localDate())
  expect((await occurrencesOf(late.id)).map(row => [row.due_date, row.status])).toEqual([[localDate(), 'pending']])
  await page.goto(`/app/objectifs/${reading.id}`)
  await expect(page.getByTestId('goal-dependency')).toContainText(`Débloqué : « Acheter le livre ${runId} » est réussi.`)
})

test('mode indicatif : toutes les échéances sont créées, l’ordre est seulement affiché', async ({ page }) => {
  await signUp(page, 'indicatif')
  const goal = await createGoal(page, {
    type: 'project', title: `Déménager ${runId}`, sequentialMilestones: true, dependencyMode: 'soft',
    milestones: [{ title: 'Cartons', dueDate: localDate(1) }, { title: 'Camion', dueDate: localDate(3) }],
  })
  expect((await occurrencesOf(goal.id)).map(row => row.order_index)).toEqual([0, 1])
  await page.goto(`/app/objectifs/${goal.id}`)
  await expect(page.getByTestId('milestone-2')).toContainText('Recommandé après l\'étape 1')
  await expect(page.getByTestId('milestone-2')).not.toContainText('Verrouillé')
})
