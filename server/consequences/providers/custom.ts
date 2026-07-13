import { useDatabase, schema } from '../../database'
import {
  customConfigSchema,
  type ConsequenceProvider,
  type CustomConfig,
} from '../types'

export const customProvider: ConsequenceProvider<CustomConfig> = {
  type: 'custom',

  async validate(config: unknown): Promise<CustomConfig> {
    return customConfigSchema.parse(config ?? {})
  },

  async estimate(config: CustomConfig) {
    return {
      label: 'Rappel personnalisé',
      description: config.message,
    }
  },

  async execute(payload) {
    const db = useDatabase()
    const message = `Tu t'étais engagé à :\n\n${payload.config.message}`

    const [notification] = await db.insert(schema.notifications).values({
      userId: payload.userId,
      title: 'Conséquence personnalisée',
      message,
      metadata: {
        goalId: payload.goalId,
        occurrenceId: payload.occurrenceId,
        consequenceHistoryId: payload.historyId,
        customMessage: payload.config.message,
      },
    }).returning()

    return {
      notificationId: notification.id,
      message,
    }
  },
}
