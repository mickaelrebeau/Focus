import { describe, it, expect } from 'vitest'
import { getConsequenceProvider, isKnownProviderType, listConsequenceProviders } from '../../server/consequences/registry'

describe('consequences registry', () => {
  it('returns all registered providers', () => {
    const providers = listConsequenceProviders()
    expect(providers).toHaveLength(6)
    expect(providers.map(provider => provider.type)).toEqual([
      'credits',
      'donation',
      'stripe',
      'community-pot',
      'random-user',
      'custom',
    ])
  })

  it('gets provider by type', () => {
    const provider = getConsequenceProvider('credits')
    expect(provider.type).toBe('credits')
  })

  it('recognizes known provider types', () => {
    expect(isKnownProviderType('donation')).toBe(true)
    expect(isKnownProviderType('unknown')).toBe(false)
  })

  it('throws for unknown provider', () => {
    expect(() => getConsequenceProvider('unknown')).toThrow('Provider de conséquence inconnu')
  })
})
