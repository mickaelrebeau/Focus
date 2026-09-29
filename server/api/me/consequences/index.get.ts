import { asc, eq } from 'drizzle-orm'
import { getUserFromEvent, requireAuth } from '../../../utils/auth'
import { useDatabase, schema } from '../../../database'

export default defineEventHandler(async (event) => {
  const user = requireAuth(await getUserFromEvent(event))
  const db = useDatabase()

  const consequences = await db
    .select()
    .from(schema.userConsequences)
    .where(eq(schema.userConsequences.userId, user.id))
    .orderBy(asc(schema.userConsequences.priority))

  // Message à un proche : état du consentement du contact, affiché dans les réglages
  const contacts = consequences.some(item => item.type === 'accountability-message')
    ? await db
        .select({
          email: schema.accountabilityContacts.email,
          status: schema.accountabilityContacts.status,
          invitedAt: schema.accountabilityContacts.invitedAt,
        })
        .from(schema.accountabilityContacts)
        .where(eq(schema.accountabilityContacts.userId, user.id))
    : []

  return {
    consequences: consequences.map(item => item.type === 'accountability-message'
      ? { ...item, contact: contacts.find(contact => contact.email === item.config.contactEmail) ?? null }
      : item),
  }
})
