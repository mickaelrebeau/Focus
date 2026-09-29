import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import postgres from 'postgres'
import { E2E_BASE_URL, E2E_DATABASE_URL, E2E_MAIL_DIR, E2E_REDIS_URL, E2E_TIMEZONE } from './env'

// Message à un proche : double opt-in (utilisateur puis contact), exécution par le vrai worker
// consequences après un échec, un message par jour au plus, désinscription du contact.
const runId = Date.now().toString(36)
const sql = postgres(E2E_DATABASE_URL, { max: 1, onnotice: () => {} })
let worker: ChildProcess | null = null

test.afterAll(async () => {
  worker?.kill()
  await sql.end()
})

interface Mail { to: string, subject: string, text: string, headers: Record<string, string> }

async function mailsTo(email: string): Promise<Mail[]> {
  const files = await readdir(E2E_MAIL_DIR).catch(() => [] as string[])
  const mails = await Promise.all(files.map(async file => JSON.parse(await readFile(join(E2E_MAIL_DIR, file), 'utf8')) as Mail))
  return mails.filter(mail => mail.to === email)
}

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: E2E_TIMEZONE }).format(new Date())
}

async function failTodayGoal(page: Page, title: string) {
  await expect(page.request.post('/api/goals', {
    data: { type: 'one_time', title, dueDate: today(), dueTime: '23:59' },
  })).resolves.toBeOK()
  await sql`
    UPDATE occurrences o SET due_at = now() - interval '1 minute'
    FROM goals g WHERE o.goal_id = g.id AND g.title = ${title}
  `
  // Lecture : l'échéance expire et les conséquences partent dans la file du worker
  await expect(page.request.get('/api/occurrences?filter=today')).resolves.toBeOK()
}

test('double opt-in, envoi par le worker après un échec, puis désinscription du contact', async ({ page, browser }) => {
  const email = `accountability-${runId}@focus.test`
  const contactEmail = `proche-${runId}@focus.test`
  await expect(page.request.post('/api/auth/register', {
    data: { email, password: randomBytes(16).toString('base64url'), displayName: 'Zoé' },
  })).resolves.toBeOK()
  await expect(page.request.patch('/api/user/settings', {
    data: { displayName: 'Zoé', timezone: E2E_TIMEZONE, leaderboardOptIn: false },
  })).resolves.toBeOK()

  // Premier opt-in : l'utilisateur coche le consentement, sinon rien n'est enregistré
  const refused = await page.request.post('/api/me/consequences', {
    data: { type: 'accountability-message', amount: 0, config: { contactEmail } },
  })
  expect(refused.status()).toBe(400)
  const ownEmail = await page.request.post('/api/me/consequences', {
    data: { type: 'accountability-message', amount: 0, config: { contactEmail: email, userConsent: true } },
  })
  expect(ownEmail.status()).toBe(400)

  await page.goto('/app/reglages/consequences')
  await page.getByRole('button', { name: /Message à un proche/ }).click()
  await page.getByLabel('Email du contact').fill(contactEmail)
  await page.getByLabel('Prénom du contact').fill('Sam')
  const send = page.getByRole('button', { name: 'Envoyer l\'invitation' })
  await expect(send).toBeDisabled()
  await page.getByLabel(/J'accepte qu'un email soit envoyé à ce contact/).check()
  await send.click()
  await expect(page.getByText('Invitation envoyée.')).toBeVisible()
  await expect(page.getByTestId('contact-status')).toContainText('En attente de réponse du contact')

  // Invitation reçue par le contact, avec le lien de consentement
  await expect.poll(async () => (await mailsTo(contactEmail)).length).toBe(1)
  const [invitation] = await mailsTo(contactEmail)
  expect(invitation!.subject).toBe('Zoé vous demande d\'être son contact de confiance sur Focus')
  expect(invitation!.text).toContain('Bonjour Sam,')
  const link = invitation!.text.match(/http\S+\/contact\/[\w-]+/)![0]
  expect(link.startsWith(E2E_BASE_URL)).toBe(true)

  // Échec avant l'accord du contact : aucun message
  await failTodayGoal(page, `Avant accord ${runId}`)
  const [pending] = await sql`
    SELECT h.id FROM consequence_history h JOIN goals g ON g.id = h.goal_id
    WHERE g.title = ${`Avant accord ${runId}`} AND h.provider = 'accountability-message'
  `
  expect(pending).toBeDefined()

  // Le vrai worker consequences traite la file (et reprend les jobs en attente)
  worker = spawn('pnpm', ['exec', 'tsx', 'server/workers/consequences.ts'], {
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL, REDIS_URL: E2E_REDIS_URL, MAIL_OUTBOX_DIR: E2E_MAIL_DIR, APP_URL: E2E_BASE_URL },
    stdio: 'ignore',
  })
  await expect.poll(async () => {
    const [row] = await sql`SELECT status::text AS status, metadata FROM consequence_history WHERE id = ${pending!.id}`
    return row && { status: row.status, result: row.metadata.result }
  }, { timeout: 30_000 }).toEqual({ status: 'completed', result: { skipped: true, reason: 'contact_not_confirmed' } })
  expect(await mailsTo(contactEmail)).toHaveLength(1)

  // Second opt-in : le contact accepte depuis le lien, sans compte
  const contact = await browser.newContext()
  const contactPage = await contact.newPage()
  await contactPage.goto(link)
  await expect(contactPage.getByRole('heading', { name: 'Zoé vous choisit comme contact de confiance' })).toBeVisible()
  await contactPage.getByRole('button', { name: 'J\'accepte' }).click()
  await expect(contactPage.getByRole('status').filter({ hasText: 'C\'est noté' })).toHaveText('C\'est noté : vous êtes le contact de confiance de Zoé.')
  const [consent] = await sql`SELECT status, confirmed_at FROM accountability_contacts WHERE email = ${contactEmail}`
  expect(consent!.status).toBe('confirmed')
  expect(consent!.confirmed_at).not.toBeNull()
  await page.reload()
  await expect(page.getByTestId('contact-status')).toContainText('Contact confirmé')

  // Deux échecs le même jour : un seul message
  await failTodayGoal(page, `Courir ${runId}`)
  await failTodayGoal(page, `Lire ${runId}`)
  await expect.poll(async () => (await mailsTo(contactEmail)).length, { timeout: 30_000 }).toBe(2)
  await expect.poll(async () => {
    const rows = await sql`
      SELECT h.metadata->'result' AS result FROM consequence_history h JOIN goals g ON g.id = h.goal_id
      WHERE g.title IN (${`Courir ${runId}`}, ${`Lire ${runId}`}) AND h.provider = 'accountability-message' AND h.status = 'completed'
    `
    return rows.map(row => row.result.sent ? 'sent' : row.result.reason).sort()
  }, { timeout: 30_000 }).toEqual(['daily_limit', 'sent'])

  const message = (await mailsTo(contactEmail)).find(mail => mail !== invitation && !mail.subject.includes('contact de confiance'))!
  const [, month, day] = today().split('-')
  expect(message.subject).toBe(`Zoé n'a pas tenu son engagement du ${day}/${month}`)
  expect(message.text).toMatch(new RegExp(`Zoé n'a pas tenu son engagement « (Courir|Lire) ${runId} » du ${day}/${month}\\.`))
  expect(message.text).toContain(`Ne plus recevoir ces messages : ${link}`)
  expect(message.headers['List-Unsubscribe']).toBe(`<${link}>`)

  // Désinscription du contact : plus rien ne part, et l'utilisateur ne peut pas le réinviter
  await contactPage.goto(link)
  await contactPage.getByRole('button', { name: 'Ne plus recevoir de messages' }).click()
  await expect(contactPage.getByRole('status').filter({ hasText: 'C\'est noté' })).toHaveText('C\'est noté : vous ne recevrez aucun message de la part de Zoé.')
  const [row] = await sql`SELECT id FROM user_consequences WHERE type = 'accountability-message' AND user_id = (SELECT id FROM users WHERE email = ${email})`
  const reinvite = await page.request.patch(`/api/me/consequences/${row!.id}`, {
    data: { enabled: true, config: { contactEmail, contactName: 'Sam', userConsent: true } },
  })
  expect(reinvite.status()).toBe(409)
  const [audit] = await sql`SELECT count(*)::int AS n FROM audit_logs WHERE action LIKE 'accountability.contact_%' AND details->>'userId' = (SELECT id::text FROM users WHERE email = ${email})`
  expect(audit!.n).toBe(2)
  await contact.close()
})
