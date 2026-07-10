import { z } from 'zod'
import { TIMEZONE_VALUES, DEFAULT_TIMEZONE } from '../../shared/timezones'

export const timezoneSchema = z.enum(TIMEZONE_VALUES, { message: 'Fuseau horaire invalide' })

export const emailSchema = z.string().email('Email invalide')
export const passwordSchema = z.string().min(8, 'Minimum 8 caractères')

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().min(2, 'Minimum 2 caractères').max(50),
  timezone: timezoneSchema.optional().default(DEFAULT_TIMEZONE),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis'),
})

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
})

export const recurrenceConfigSchema = z.object({
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  timesPerWeek: z.number().min(1).max(7).optional(),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
})

export const milestoneSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export const createGoalSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('one_time'),
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    category: z.string().max(50).optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dueTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  }),
  z.object({
    type: z.literal('recurring'),
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    category: z.string().max(50).optional(),
    recurrenceType: z.enum(['daily', 'weekly_days', 'weekly_count']),
    recurrenceConfig: recurrenceConfigSchema,
  }),
  z.object({
    type: z.literal('project'),
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    category: z.string().max(50).optional(),
    milestones: z.array(milestoneSchema).min(1),
  }),
])

export const completeOccurrenceSchema = z.object({
  note: z.string().max(1000).optional(),
  proofType: z.enum(['text', 'url', 'image']).optional(),
  proofContent: z.string().max(5000).optional(),
  proofUrl: z.string().url().optional(),
})

export const updateSettingsSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  timezone: timezoneSchema.optional(),
  leaderboardOptIn: z.boolean().optional(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: passwordSchema,
}).refine(data => data.currentPassword !== data.newPassword, {
  message: 'Le nouveau mot de passe doit être différent',
  path: ['newPassword'],
})

export const adminAdjustSchema = z.object({
  amount: z.number().int(),
  reason: z.string().min(5, 'Motif requis (min 5 caractères)'),
})

export const adminReviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewNote: z.string().max(1000).optional(),
})

export function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0]?.message ?? 'Données invalides',
    })
  }
  return result.data
}
