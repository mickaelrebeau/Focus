import { z } from 'zod'

export const CONSEQUENCE_PROVIDER_KEYS = [
  'credits',
  'donation',
  'stripe',
  'community-pot',
  'random-user',
  'custom',
] as const

export type ConsequenceProviderKey = typeof CONSEQUENCE_PROVIDER_KEYS[number]

export interface ConsequenceExecutionPayload {
  historyId: string
  userId: string
  goalId: string
  occurrenceId: string
  amount: number
  config: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface ConsequenceEstimate {
  label: string
  description: string
}

export interface ConsequenceProvider<TConfig = Record<string, unknown>> {
  type: ConsequenceProviderKey
  validate(config: unknown): Promise<TConfig>
  estimate(config: TConfig, amount: number): Promise<ConsequenceEstimate>
  execute(payload: ConsequenceExecutionPayload & { config: TConfig }): Promise<Record<string, unknown>>
}

export const creditsConfigSchema = z.object({}).strict()

export const donationConfigSchema = z.object({
  association: z.string().min(1, 'Association requise').max(100),
})

export const stripeConfigSchema = z.object({}).strict()

export const communityPotConfigSchema = z.object({}).strict()

export const randomUserConfigSchema = z.object({
  minimumScore: z.number().int().min(0).optional().default(0),
})

export const customConfigSchema = z.object({
  message: z.string().min(1, 'Message requis').max(500),
})

export type CreditsConfig = z.infer<typeof creditsConfigSchema>
export type DonationConfig = z.infer<typeof donationConfigSchema>
export type StripeConfig = z.infer<typeof stripeConfigSchema>
export type CommunityPotConfig = z.infer<typeof communityPotConfigSchema>
export type RandomUserConfig = z.infer<typeof randomUserConfigSchema>
export type CustomConfig = z.infer<typeof customConfigSchema>

export type ProviderConfigMap = {
  credits: CreditsConfig
  donation: DonationConfig
  stripe: StripeConfig
  'community-pot': CommunityPotConfig
  'random-user': RandomUserConfig
  custom: CustomConfig
}

export { DONATION_ASSOCIATIONS } from '#shared/donation-associations'

export function formatEuroAmount(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

export function isMonetaryProvider(type: ConsequenceProviderKey): boolean {
  return type === 'donation'
    || type === 'stripe'
    || type === 'community-pot'
    || type === 'random-user'
}
