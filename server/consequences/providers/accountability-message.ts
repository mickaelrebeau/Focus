import { eq } from 'drizzle-orm'
import { useDatabase, schema } from '../../database'
import {
  buildAccountabilityEmail,
  contactPageUrl,
  formatDayMonth,
  getContactForUser,
  releaseDailyMessage,
  renderAccountabilityTemplate,
  reserveDailyMessage,
} from '../../utils/accountability'
import { isMailerConfigured, sendMail } from '../../utils/mailer'
import { getTodayInTimezone } from '../../utils/occurrences'
import {
  accountabilityMessageConfigSchema,
  type AccountabilityMessageConfig,
  type ConsequenceProvider,
} from '../types'

export const accountabilityMessageProvider: ConsequenceProvider<AccountabilityMessageConfig> = {
  type: 'accountability-message',

  async validate(config: unknown): Promise<AccountabilityMessageConfig> {
    return accountabilityMessageConfigSchema.parse(config ?? {})
  },

  async estimate(config: AccountabilityMessageConfig) {
    const contact = config.contactName ? `${config.contactName} (${config.contactEmail})` : config.contactEmail
    return {
      label: 'Message à un proche',
      description: `Un email est envoyé à ${contact} après un échec, s'il ou elle a accepté (au plus un par jour).`,
    }
  },

  async execute(payload) {
    // Second opt-in : rien ne part vers un contact qui n'a pas (ou plus) accepté
    const contact = await getContactForUser(payload.userId, payload.config.contactEmail)
    if (!contact || contact.status !== 'confirmed') {
      return { skipped: true, reason: contact?.status === 'declined' ? 'contact_declined' : 'contact_not_confirmed' }
    }
    if (!isMailerConfigured()) {
      console.warn('[accountability-message] Envoi d\'emails non configuré : message ignoré')
      return { skipped: true, reason: 'mailer_not_configured' }
    }

    const db = useDatabase()
    const [context] = await db
      .select({
        userName: schema.users.displayName,
        timezone: schema.users.timezone,
        goalTitle: schema.goals.title,
        dueDate: schema.occurrences.dueDate,
      })
      .from(schema.occurrences)
      .innerJoin(schema.goals, eq(schema.goals.id, schema.occurrences.goalId))
      .innerJoin(schema.users, eq(schema.users.id, schema.occurrences.userId))
      .where(eq(schema.occurrences.id, payload.occurrenceId))
      .limit(1)
    if (!context) throw new Error('Échéance introuvable')

    const today = getTodayInTimezone(context.timezone)
    if (!(await reserveDailyMessage(contact.id, today))) {
      return { skipped: true, reason: 'daily_limit', contactId: contact.id }
    }

    const date = formatDayMonth(context.dueDate)
    const body = renderAccountabilityTemplate(payload.config.message, { name: context.userName, goal: context.goalTitle, date })
    try {
      await sendMail({
        to: contact.email,
        ...buildAccountabilityEmail({ userName: context.userName, date, body, token: contact.manageToken }),
        unsubscribeUrl: contactPageUrl(contact.manageToken),
      })
    } catch (error) {
      await releaseDailyMessage(contact.id, today, contact.lastMessageDate)
      throw error
    }

    return { sent: true, contactId: contact.id, date }
  },
}
