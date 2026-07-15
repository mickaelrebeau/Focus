import { ConsequenceError } from './errors'
import type { ConsequenceProvider, ConsequenceProviderKey } from './types'
import { creditsProvider } from './providers/credits'
import { donationProvider } from './providers/donation'
import { stripeProvider } from './providers/stripe'
import { randomUserProvider } from './providers/random-user'
import { customProvider } from './providers/custom'
import { mandatoryProofProvider } from './providers/mandatory-proof'

const providers = new Map<ConsequenceProviderKey, ConsequenceProvider>([
  ['credits', creditsProvider],
  ['donation', donationProvider],
  ['stripe', stripeProvider],
  ['random-user', randomUserProvider],
  ['custom', customProvider],
  ['mandatory-proof', mandatoryProofProvider],
])

export function getConsequenceProvider(type: string): ConsequenceProvider {
  const provider = providers.get(type as ConsequenceProviderKey)
  if (!provider) {
    throw new ConsequenceError(`Provider de conséquence inconnu : ${type}`)
  }
  return provider
}

export function listConsequenceProviders(): ConsequenceProvider[] {
  return Array.from(providers.values())
}

export function isKnownProviderType(type: string): type is ConsequenceProviderKey {
  return providers.has(type as ConsequenceProviderKey)
}
