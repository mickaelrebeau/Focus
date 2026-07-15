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
      'random-user',
      'custom',
      'mandatory-proof',
    ])
  })

  it('gets provider by type', () => {
    const provider = getConsequenceProvider('credits')
    expect(provider.type).toBe('credits')
  })

  it('recognizes known provider types', () => {
    expect(isKnownProviderType('donation')).toBe(true)
    expect(isKnownProviderType('mandatory-proof')).toBe(true)
    expect(isKnownProviderType('streak-reset')).toBe(false)
    expect(isKnownProviderType('community-pot')).toBe(false)
    expect(isKnownProviderType('unknown')).toBe(false)
  })

  it('throws for unknown provider', () => {
    expect(() => getConsequenceProvider('unknown')).toThrow('Provider de conséquence inconnu')
    expect(() => getConsequenceProvider('streak-reset')).toThrow('Provider de conséquence inconnu')
  })
})
