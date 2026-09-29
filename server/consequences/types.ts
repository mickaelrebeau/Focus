import { z } from 'zod'

export const CONSEQUENCE_PROVIDER_KEYS = [
  'credits',
  'donation',
  'stripe',
  'community-pot',
  'random-user',
  'custom',
  'mandatory-proof',
  'accountability-message',
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

export const mandatoryProofConfigSchema = z.object({}).strict()

/** Variables du message : {nom} (nom d'affichage), {objectif}, {date} (JJ/MM de l'échéance). */
export const DEFAULT_ACCOUNTABILITY_TEMPLATE = '{nom} n\'a pas tenu son engagement « {objectif} » du {date}.'

export const accountabilityMessageConfigSchema = z.object({
  contactEmail: z.string().trim().toLowerCase().pipe(z.email('Email du contact invalide')).pipe(z.string().max(254)),
  contactName: z.string().trim().max(80).optional().default(''),
  message: z.string().trim().min(1, 'Message requis').max(500).optional().default(DEFAULT_ACCOUNTABILITY_TEMPLATE),
  // Premier opt-in : l'utilisateur accepte explicitement qu'un email parte à ce contact
  userConsent: z.literal(true, { message: 'Confirmez que vous acceptez l\'envoi de messages à ce contact' }),
})

export type CreditsConfig = z.infer<typeof creditsConfigSchema>
export type DonationConfig = z.infer<typeof donationConfigSchema>
export type StripeConfig = z.infer<typeof stripeConfigSchema>
export type CommunityPotConfig = z.infer<typeof communityPotConfigSchema>
export type RandomUserConfig = z.infer<typeof randomUserConfigSchema>
export type CustomConfig = z.infer<typeof customConfigSchema>
export type MandatoryProofConfig = z.infer<typeof mandatoryProofConfigSchema>
export type AccountabilityMessageConfig = z.infer<typeof accountabilityMessageConfigSchema>

export type ProviderConfigMap = {
  credits: CreditsConfig
  donation: DonationConfig
  stripe: StripeConfig
  'community-pot': CommunityPotConfig
  'random-user': RandomUserConfig
  custom: CustomConfig
  'mandatory-proof': MandatoryProofConfig
  'accountability-message': AccountabilityMessageConfig
}

export function formatEuroAmount(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

export function isMonetaryProvider(type: ConsequenceProviderKey): boolean {
  return type === 'donation'
    || type === 'stripe'
}

export function isCreditsProvider(type: ConsequenceProviderKey): boolean {
  return type === 'credits'
    || type === 'random-user'
}

export function isNonMonetaryBehaviorProvider(type: ConsequenceProviderKey): boolean {
  return type === 'custom'
    || type === 'mandatory-proof'
    || type === 'accountability-message'
}
