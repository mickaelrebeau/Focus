import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import nodemailer, { type Transporter } from 'nodemailer'

// Envoi d'emails par SMTP (tout fournisseur : Resend, Brevo, SES, Mailgun, serveur maison…).
// Lu directement dans process.env : le service web et le worker consequences envoient tous deux.
//   SMTP_URL        smtps://utilisateur:motdepasse@smtp.exemple.com:465
//   MAIL_FROM       "Focus <no-reply@exemple.com>"
//   MAIL_OUTBOX_DIR dossier où écrire les emails en JSON au lieu de les envoyer (dev, tests)

export interface MailMessage {
  to: string
  subject: string
  text: string
  /** En-têtes List-Unsubscribe : désinscription en un clic depuis le client mail */
  unsubscribeUrl?: string
}

export class MailerNotConfiguredError extends Error {
  constructor() {
    super('Envoi d\'emails non configuré (SMTP_URL et MAIL_FROM)')
  }
}

let transporter: Transporter | null = null

export function isMailerConfigured() {
  return Boolean(process.env.MAIL_OUTBOX_DIR || (process.env.SMTP_URL && process.env.MAIL_FROM))
}

function mailFrom() {
  return process.env.MAIL_FROM || 'Focus <no-reply@localhost>'
}

export async function sendMail(message: MailMessage) {
  const headers: Record<string, string> = {}
  if (message.unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${message.unsubscribeUrl}>`
  }

  const outbox = process.env.MAIL_OUTBOX_DIR
  if (outbox) {
    await mkdir(outbox, { recursive: true })
    const file = join(outbox, `${Date.now()}-${randomBytes(4).toString('hex')}.json`)
    await writeFile(file, JSON.stringify({ from: mailFrom(), ...message, headers }, null, 2))
    return { messageId: file }
  }

  if (!process.env.SMTP_URL || !process.env.MAIL_FROM) throw new MailerNotConfiguredError()
  transporter ??= nodemailer.createTransport(process.env.SMTP_URL)
  const info = await transporter.sendMail({
    from: mailFrom(),
    to: message.to,
    subject: message.subject,
    text: message.text,
    headers,
  })
  return { messageId: info.messageId }
}
