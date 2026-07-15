import { z } from 'zod'
import { CONSEQUENCE_PROVIDER_KEYS } from './types'

export const createUserConsequenceSchema = z.object({
  type: z.enum(CONSEQUENCE_PROVIDER_KEYS),
  enabled: z.boolean().optional().default(true),
  amount: z.number().int().min(0),
  priority: z.number().int().min(0).optional(),
  config: z.record(z.string(), z.unknown()).optional().default({}),
})

export const updateUserConsequenceSchema = z.object({
  enabled: z.boolean().optional(),
  amount: z.number().int().min(0).optional(),
  priority: z.number().int().min(0).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
})

export const estimateConsequenceSchema = z.object({
  type: z.enum(CONSEQUENCE_PROVIDER_KEYS),
  amount: z.number().int().min(0),
  config: z.record(z.string(), z.unknown()).optional().default({}),
})

export const reorderConsequencesSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
})
