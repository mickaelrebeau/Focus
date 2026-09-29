import { randomBytes } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { useDatabase, schema } from '../database'
import { MailerNotConfiguredError, isMailerConfigured, sendMail } from './mailer'

/** Délai minimal entre deux invitations au même contact. */
export const INVITATION_RESEND_HOURS = 24

export type ContactStatus = 'pending' | 'confirmed' | 'declined'

export class AccountabilityError extends Error {
  constructor(public code: 'contact_declined' | 'mailer_not_configured' | 'own_email' | 'not_found') {
    super(code)
  }
}

const ERROR_RESPONSES = {
  contact_declined: { statusCode: 409, message: 'Ce contact a refusé de recevoir vos messages' },
  mailer_not_configured: { statusCode: 503, message: 'L\'envoi d\'emails n\'est pas configuré sur cette instance' },
  own_email: { statusCode: 400, message: 'Choisissez l\'email d\'une autre personne que vous' },
  not_found: { statusCode: 404, message: 'Lien invalide ou expiré' },
} as const

export function toAccountabilityHttpError(error: unknown): never {
  if (error instanceof AccountabilityError) {
    throw createError({ ...ERROR_RESPONSES[error.code], data: { code: error.code } })
  }
  throw error
}

export function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '')
  try {
    return useRuntimeConfig().public.appUrl.replace(/\/$/, '')
  } catch {
    return 'http://localhost:3000'
  }
}

export function contactPageUrl(token: string) {
  return `${appUrl()}/contact/${token}`
}

/** « 12/10 » : date d'une échéance (AAAA-MM-JJ) au format JJ/MM. */
export function formatDayMonth(dueDate: string) {
  const [, month, day] = dueDate.split('-')
  return `${day}/${month}`
}

/** Remplace {nom}, {objectif} et {date} ; les autres accolades sont laissées telles quelles. */
export function renderAccountabilityTemplate(template: string, values: { name: string, goal: string, date: string }) {
  return template
    .replaceAll('{nom}', values.name)
    .replaceAll('{objectif}', values.goal)
    .replaceAll('{date}', values.date)
}

export function buildInvitationEmail(input: { userName: string, contactName: string, token: string }) {
  const greeting = input.contactName ? `Bonjour ${input.contactName},` : 'Bonjour,'
  return {
    subject: `${input.userName} vous demande d'être son contact de confiance sur Focus`,
    text: [
      greeting,
      '',
      `${input.userName} utilise Focus pour tenir ses engagements et aimerait que vous soyez prévenu(e) par email lorsqu'il ou elle n'en tient pas un : au plus un message par jour.`,
      '',
      'Rien ne vous sera envoyé sans votre accord. Pour accepter ou refuser :',
      contactPageUrl(input.token),
      '',
      'Vous pourrez arrêter à tout moment depuis ce même lien.',
      '',
      'Si vous ne connaissez pas cette personne, ignorez cet email : aucun autre message ne vous sera envoyé.',
    ].join('\n'),
  }
}

export function buildAccountabilityEmail(input: { userName: string, date: string, body: string, token: string }) {
  return {
    subject: `${input.userName} n'a pas tenu son engagement du ${input.date}`,
    text: [
      input.body,
      '',
      '—',
      `Vous recevez cet email parce que vous avez accepté d'être le contact de confiance de ${input.userName} sur Focus.`,
      `Ne plus recevoir ces messages : ${contactPageUrl(input.token)}`,
    ].join('\n'),
  }
}

function newManageToken() {
  return randomBytes(24).toString('base64url')
}

/**
 * Appelée à l'enregistrement de la conséquence : crée le contact et lui envoie l'invitation
 * (second opt-in), ou la renvoie si la précédente date de plus de 24 h. Refuse un contact
 * qui a décliné, et échoue si l'instance ne peut pas envoyer d'email.
 */
export async function ensureAccountabilityContact(
  user: { id: string, email: string, displayName: string },
  config: { contactEmail: string, contactName: string },
  now = new Date(),
) {
  if (config.contactEmail === user.email.toLowerCase()) throw new AccountabilityError('own_email')

  const db = useDatabase()
  const [existing] = await db
    .select()
    .from(schema.accountabilityContacts)
    .where(and(
      eq(schema.accountabilityContacts.userId, user.id),
      eq(schema.accountabilityContacts.email, config.contactEmail),
    ))
    .limit(1)

  if (existing?.status === 'declined') throw new AccountabilityError('contact_declined')
  if (existing?.status === 'confirmed') {
    if ((existing.name ?? '') !== config.contactName) {
      await db.update(schema.accountabilityContacts).set({ name: config.contactName || null }).where(eq(schema.accountabilityContacts.id, existing.id))
    }
    return { status: existing.status, invited: false }
  }

  const recentlyInvited = existing
    && now.getTime() - existing.invitedAt.getTime() < INVITATION_RESEND_HOURS * 60 * 60 * 1000
  if (recentlyInvited) return { status: existing.status, invited: false }

  if (!isMailerConfigured()) throw new AccountabilityError('mailer_not_configured')

  const token = existing?.manageToken ?? newManageToken()
  const [contact] = existing
    ? await db
        .update(schema.accountabilityContacts)
        .set({ name: config.contactName || null, invitedAt: now })
        .where(eq(schema.accountabilityContacts.id, existing.id))
        .returning()
    : await db
        .insert(schema.accountabilityContacts)
        .values({ userId: user.id, email: config.contactEmail, name: config.contactName || null, manageToken: token, invitedAt: now })
        .returning()

  try {
    await sendMail({
      to: config.contactEmail,
      ...buildInvitationEmail({ userName: user.displayName, contactName: config.contactName, token }),
      unsubscribeUrl: contactPageUrl(token),
    })
  } catch (error) {
    if (error instanceof MailerNotConfiguredError) throw new AccountabilityError('mailer_not_configured')
    throw error
  }
  return { status: contact!.status, invited: true }
}

export async function getContactForUser(userId: string, email: string) {
  const [contact] = await useDatabase()
    .select()
    .from(schema.accountabilityContacts)
    .where(and(eq(schema.accountabilityContacts.userId, userId), eq(schema.accountabilityContacts.email, email)))
    .limit(1)
  return contact ?? null
}

/** Page publique du contact : qui l'invite et où en est son consentement. */
export async function getContactByToken(token: string) {
  const [row] = await useDatabase()
    .select({ contact: schema.accountabilityContacts, userName: schema.users.displayName })
    .from(schema.accountabilityContacts)
    .innerJoin(schema.users, eq(schema.users.id, schema.accountabilityContacts.userId))
    .where(eq(schema.accountabilityContacts.manageToken, token))
    .limit(1)
  if (!row) throw new AccountabilityError('not_found')
  return row
}

/** Second opt-in : le contact accepte, ou refuse (et peut changer d'avis depuis le même lien). */
export async function setContactConsent(token: string, accept: boolean, now = new Date()) {
  const { contact } = await getContactByToken(token)
  const [updated] = await useDatabase()
    .update(schema.accountabilityContacts)
    .set(accept
      ? { status: 'confirmed', confirmedAt: now, declinedAt: null }
      : { status: 'declined', declinedAt: now })
    .where(eq(schema.accountabilityContacts.id, contact.id))
    .returning()
  return updated!
}

/**
 * Réserve le message du jour pour ce contact. Renvoie false si un message est déjà parti
 * aujourd'hui (au plus un par jour, même si plusieurs objectifs échouent).
 */
export async function reserveDailyMessage(contactId: string, dateKey: string) {
  const reserved = await useDatabase()
    .update(schema.accountabilityContacts)
    .set({ lastMessageDate: dateKey })
    .where(and(
      eq(schema.accountabilityContacts.id, contactId),
      eq(schema.accountabilityContacts.status, 'confirmed'),
      sql`${schema.accountabilityContacts.lastMessageDate} IS DISTINCT FROM ${dateKey}::date`,
    ))
    .returning({ id: schema.accountabilityContacts.id })
  return reserved.length > 0
}

/** Envoi échoué : libère la réservation pour que la nouvelle tentative du worker puisse partir. */
export async function releaseDailyMessage(contactId: string, dateKey: string, previous: string | null) {
  await useDatabase()
    .update(schema.accountabilityContacts)
    .set({ lastMessageDate: previous })
    .where(and(
      eq(schema.accountabilityContacts.id, contactId),
      sql`${schema.accountabilityContacts.lastMessageDate} = ${dateKey}::date`,
    ))
}
